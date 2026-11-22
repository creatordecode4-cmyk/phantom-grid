# PHANTOM GRID

An open-world 3D web game set in **Port Meridian**, a fictional American coastal city in the year 2090.
A realistic city of the future: sculpted glass towers, hanging gardens, sky bridges,
electric cars and a maglev line. No cartoon look, no neon-toy look.

This is **Phase 4, "Prologue + Chapter 1 playable"**: the story starts. A title screen, a save game,
film scenes, choices that are remembered, and the first two parts of the story - the Prologue
"LAST LAP" and Chapter 1 "RAIN DELIVERY" - on top of the city, the cars and the characters of
the phases before. See "The story (version 4.0)" below. **Free roam is still there** (title
screen, FREE ROAM): the whole city, the test garage, every old button.
Phase 2, "Life and Driving", made the playable, realistic first area of the city that runs in a phone browser, with cars to drive, traffic, people, a map with GPS and a first mission.
Since version 1.2 all buildings are **futuristic** and are put together from a
**kit of parts** (twisted tower bodies, glass curtain walls with fins, ribbon frames,
garden terraces, helipads ...). Eleven **hero buildings** follow the reference pictures
in `assets/reference/buildings/` - see "The buildings" below.
Version 1.3 is a polish pass: natural trees and palms, real-looking asphalt, more
reflecting glass, people on the sidewalks, driving cars and a warm sun with a soft glow -
see "The polish pass" below.
Version 2.1 is the **vehicles pass**: seven vehicles with their own jobs (police cars, an
armored van, a supercar with nitro, a boat, a drone), a new driving model with engine, gears
and tire grip, damage, smoke and skid marks, four camera views and a wanted level - see
"The vehicles pass" below.
Version 2.2 gives the characters an **automatic skeleton**: the plain character models are
rigged in the browser when the game loads and moved by code (walking, running, standing,
driving) - see "Automatic character rig" below.

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
| Get into / out of a car | `CAR` button (shows up next to a car), `EXIT` while driving | `E` |
| Drive | `◀` `▶` steer (or `TILT`: steer by tilting the phone), `GAS`, `BRAKE` (hold = reverse), `HANDBRAKE`, `HORN`. The pedals are analog: slide your finger up on `GAS` / `BRAKE` for more | `W` gas, `S` brake / reverse, `A` `D` steer, `Space` handbrake, `H` horn |
| Camera view | `CAM`: chase, close, hood, cockpit | `C` |
| High beam | `LIGHT` | `L` |
| Nitro (supercar) | `NITRO` | `N` |
| Siren (police cars) | the `HORN` button becomes `SIREN` | `H` |
| Drone | `UP`, `DOWN`, `GAS` forward, `BRAKE` backward, `◀` `▶` turn | `U` up, `J` down, `W` `S` `A` `D` |
| Put a vehicle in front of you (testing) | `CARS` button, then pick one | same |
| Driving assist | `ASSIST` button: Off / Normal (traction control + ABS) / Easy (also helps steering) | same |
| Character rig test | `RIG TEST` button (opens `rigtest.html`) | same |
| Look around the car | Drag on the screen | Mouse |
| Big map + waypoint | `MAP` button or tap the minimap, then tap a place | `M`, then click a place |
| Sound on / off | `SOUND` button | same |
| Dialog | Tap the box | Click the box |
| Pause menu (Resume, Settings, Restart mission, Title screen) | `II` button | `P` or `Esc` |
| Story: talk, take, deliver, read | the yellow round button that shows up | `E` |
| Story: skip a film scene | hold `HOLD TO SKIP` | hold `Enter` |
| Story: answer | tap one of the two answers | click it |
| Story: the limiter | the big red `LIMITER OFF` button | `Enter` or `O` |

One game day lasts 12 real minutes. The game starts at golden hour.

### Quality levels

| Level | What you get |
|---|---|
| **Low** | No shadows, no bloom, no sun glow, 0.75 pixel ratio, short draw distance, thicker haze, no fins and no plants on the facades, 20 people and 12 driving cars |
| **Medium** | Shadows, light bloom, sun glow, film-like color grade, fins, floor plates, plants and small parts within about 150 m, 60 people and 30 driving cars |
| **High** | Sharper shadows, more detail further away, subtle vignette and film grain, 80 people and 40 driving cars |
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
| `story=0` | skip the title screen: straight into free roam (the options above then work as before) |
| `story=prologue.1` / `story=chapter01.4` | skip the title screen: straight into that mission of the story (see the mission list below) |

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
    models.js              the small 3D models, built in code
    backdrop.js            ocean, hills, far Crown towers, highway, maglev line
  vehicles/
    carModels.js           THE FOUR CAR TYPES (sedan, SUV, van, sports coupe), built in code,
                           and how each one drives (top speed, grip ...)
    vehicleLoader.js       loads the vehicle model files from assets/vehicles/, fits them (size,
                           ground, direction) and holds THE NUMBERS OF EVERY VEHICLE (VEHICLE_SPECS)
    physics.js             how vehicles move: engine, 6 gears, tire grip, surfaces, crashes, boat, drone
    effects.js             smoke, dust, spray, sparks, skid marks and the glow of the lamps
    carParts.js            seats, dashboard and driver; cuts car bodies into doors and glass
    vehicle.js             all vehicles you can use: get in / out, doors, lights, damage, sounds, garage
  characters/
    autoRig.js             finds the joints of a character model, builds the skeleton and the skin,
                           tests every joint (PASS / WARN table)
    proceduralAnim.js      moves the skeleton: walk, run, idle, driving, foot placement, joint limits,
                           and the poses of the story (sitting, lying, arms crossed, aiming ...)
    rigWorker.js           works out a skeleton in the background, so the game does not stop meanwhile
    faceClean.js           reads a face (nose, eyes, mouth, eyebrows) and cleans painted dark rings and smudges
    faceRig.js             adds small face bones: jaw, eyelids, eyebrows, corners of the mouth
    faceSculpt.js          gives a model that was made laughing a calm face before it is rigged (Theo)
    faceAnim.js            moods (smile, sad, angry ...), blinking, the jaw while speaking
    characterLook.js       the characters' own soft light, a matt head, softer bumps on the face
  story/
    engine.js              THE STORY ENGINE: reads a chapter file and makes it happen (steps, objectives,
                           film scenes, choices, checkpoints, fail and retry). Its top explains every step
    chapters/prologue.js   THE PROLOGUE AS DATA ("LAST LAP")
    chapters/chapter01.js  CHAPTER 1 AS DATA ("RAIN DELIVERY")
    chapters/chapter02.js  CHAPTER 2 AS DATA ("WANTED") - chapter03.js goes next to it
    strings.js             EVERY TEXT of the story and its menus (translate the game here)
    save.js                the saved game: chapter, mission, checkpoint, choices, unlocked characters
    actors.js              the people of the story: loading, poses, walking, sitting in cars, looking
    drivers.js             the computer drivers: racers, Zero, the Meridian Guard, impatient cars
    director.js            the camera of the film scenes
    props.js               the small things: mixtape, photo, ticket, phone, sticker "80", parcel ...
    propsWanted.js         the things of Chapter 2: WANTED posters, news screens, Guard drones, the tarp
                           over Theo's car, the roller door, radio, mug, KEYSTONE chip, number plate ...
  ai/
    traffic.js             the other cars: lanes, traffic lights, turns, braking, honking, pulling over
    wanted.js              THE WANTED SYSTEM: 0-5 stars, Meridian Guard cars and drones that see and
                           search, hiding, COVER, scanner gates, roadblocks, disguise, BUSTED
    police.js              (old name, kept: it hands out wanted.js)
    pedestrians.js         the people: sidewalks, crosswalks, red lights
    streetLife.js          free roam: small moments in the streets (people with their own business,
                           lines you overhear when you walk past) - a list of data, easy to add to
  interiors/
    interiors.js           GOING INTO HOUSES: the real doors in the city (ENTER / EXIT), the fade, the
                           rooms' light for every hour (sun through the window, lamps, moonlight),
                           sun beams with dust; the street keeps living around the door meanwhile
    rooms.js               THE HOUSES AS DATA: Halden House (a dining kitchen and a child's room) and
                           Flat 3B (a retro kitchen) - where every piece of furniture stands
    furniture.js           the pieces: walls with windows and doors, tables, chairs, stove, fridge,
                           dresser with plates, bed, wardrobe, desk, shelves, pots, cups, books, plants
    kit.js                 the materials of the rooms (wood, tiles, wallpaper, rug ... drawn in code),
                           the darker corners, and the builder that puts a whole room into ~20 meshes
  missions/
    missions.js            THE MISSIONS AS DATA - add your story here
    missionManager.js      runs the mission steps
  audio/
    sound.js               all sounds, made in code (engine, tires, horn, crash, footsteps)
    music.js               the mixtape "DON'T SKIP" (six lo-fi tracks made in code, track 7 is empty),
                           rain, traffic hum, waves, far sirens, the chase pad, the heartbeat
  world/
    lighting.js            sky, sun, day / night, shadows, haze, reflections, street lamps
    weather.js             rain and wet streets
    postfx.js              bloom, film color grade, vignette, grain
  player/
    player.js              the character: loading, walking, collisions, animations
    camera.js              third-person camera (on foot) and chase camera (driving)
  ui/
    touchControls.js       joystick, camera drag, driving buttons, tilt steering, keyboard, mouse
    minimap.js             the round map and the full-screen map (drawn from layout.js)
    gps.js                 finds a route along the roads
    hud.js                 text, buttons, menus, mission box, dialog, loading screen
    storyUI.js             film bars, subtitles, choices, title screen, pause, settings, LIMITER OFF button,
                           rear-view mirror, tape display, things to read, the paint shop, the video
                           on the chip, the BUSTED card
    portrait.js            takes a picture of the player character's face (for posters and the news)
  utils/
    math.js                small math helpers, seeded random numbers, polygons
    geometry.js            MeshBuilder (many shapes -> one mesh), InstancedSet, DetailSet
    noise.js               noise, normal maps made from photos, canvas helpers
assets/
  textures/                the tileable photo textures (see below)
  characters/              put Nate_Calloway.glb here (and Nate_Calloway_rigged.glb with animations)
  cars/                    car model files: <name>.glb, <name>_lo.glb and cars.json
  buildings/               hero buildings: put .glb model files here (see below)
  hdri/                    optional sky photo for reflections
  reference/               the reference pictures (buildings/b01 ... b11)
docs/
  building_notes.md        notes on every reference building (written before coding)
  interior_notes.md        notes on the four interior reference pictures and how the game imitates them
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
  (about 75 on Low, about 130 on Medium, about 150 while you drive; the limit is 250; tap `FPS` to see it).
- All glass of all buildings is ONE mesh with one glass shader that paints floor
  lines, mullions and lit rooms. All panels (concrete, metal, wood, solar) are one more.
- Fins, floor plates and plants are instanced copies of a few small models, drawn
  only near the player.
- Props are only drawn near the player (bins 105 m, cars 150 m, trees 290 m ...).
- All people are ONE instanced mesh; arms and legs swing in the shader. All traffic cars of
  one type are one instanced mesh. Only the people and cars near the player exist - far
  ones are moved to a new place nearby.
- Parked cars are instanced copies; only the car you take becomes a real object with turning wheels.
- One sun casts shadows: a sharp shadow map follows the player, a second soft one
  covers the far city and is only redrawn when the sun has moved.
- At night only the 6 street lamps nearest to the player are real lights. All the
  others light the ground through one top-down "lamp light map".
- Reflections come from one small environment map that is updated when the sky changes.

---

## Phase 2: Life and Driving

**Cars you can drive.** Every parked car can be driven: stand next to it and press `CAR` (or `E`).
Four types: sedan (165 km/h), SUV (150), van (125) and the sports coupe (182). The car has
weight: the body leans in corners and dips when braking, steering gets calmer at speed, the
handbrake makes the tail slide. Walls, props and other cars stop it with a bump and a short
camera shake. Headlights and tail lights come on at dusk, the brake lights when you brake.
The numbers for each type are in `CAR_TYPES` in `src/vehicles/carModels.js`.

**Vehicle model files (`assets/vehicles/`).** Five cars come from model files (see "The
vehicles pass" below), plus a boat. They are parked around the city, drive in the traffic and
can be driven like the other cars. The original scans were about 60 MB each and one welded shell, so they were
rebuilt (see `tools/cars/`): every car now has a light version for parked cars and traffic
(about 100 KB) and a detailed version (about 1.2 MB) that is only downloaded when you get in or stand next to it.
Only the nearest vehicles show the detailed version (2 on Low, 3 on Medium, 8 on High); the
others show the light one.

**Doors, glass and interior.** On every car you drive, the driver's door really swings open
when you get in or out. The glass is see-through: you can look at the seats, the dashboard,
the steering wheel and the driver inside. A detailed model file has to contain parts with
these names: `body`, `glass`, `door_l`, `door_r` (with `door_l_glass`, `door_r_glass`
inside them) and `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr`.

**Traffic.** 30 cars (12 on Low, 40 on High) drive on the lanes written in `src/city/layout.js`
(`traffic`). They keep right, stop at red lights, keep a gap, turn left and right at crossings
(before a left turn they let the other side pass) and brake for you and for people on the road.
Only cars within 250 m exist.

**People.** 60 people (20 on Low, 80 on High; about half at night, fewer in rain) with
different clothes and heights. They walk around the blocks, wait at red lights and cross on the
crosswalks, and step out of your way.

**Animated player (optional).** Put a model with a skeleton at
`assets/characters/Nate_Calloway_rigged.glb`. If it has animations whose names contain `idle`,
`walk` and `run`, the game blends between them by speed. Without that file the plain model gets
an automatic skeleton and is moved by code (see "Automatic character rig" below).

**Sound.** All sounds are made in code with Web Audio (no sound files): engine, tire screech,
horn, crash, door, footsteps (different on sand). Sound starts after your first tap.

**Map and GPS.** The minimap shows a car shape when you drive, dots for the traffic, the mission
marker and your waypoint. `MAP` opens the big map with the district names; tap to set a waypoint.
A yellow line then shows the way along the roads and an arrow at the top points along it.

**Missions.** `src/missions/missions.js` is a plain data file. A mission is a list of steps:

| Step type | What the player has to do |
|---|---|
| `goto` | reach a place (on foot or by car) |
| `enterCar` | get into a car (a certain mission car, or any car) |
| `driveTo` | reach a place while sitting in a car |
| `wait` | stay for some seconds |
| `timer` | reach a place before the time runs out |
| `dialog` | read a box with a name and some lines of text |

The placeholder mission "Meet at Neon Mile" starts by itself: walk to the orange sports car
across the start street, get in, drive south to Neon Mile, turn right, stop at the marker and
read the dialog. Add `?mission=0` to the address to play without it.

---

## The vehicles pass (version 2.1)

### The vehicles

| File name in `assets/vehicles/` | In the game | Length | Top speed | What is special |
|---|---|---|---|---|
| `small_city_car` | CITY CAR | 3.4 m | 140 km/h | light, front-wheel drive; most of the traffic |
| `tech_patrol_car` | TECH PATROL CAR | 4.9 m | 200 km/h | police: flashing lights + siren, all-wheel drive |
| `police_coupe` | POLICE COUPE | 4.8 m | 210 km/h | police: flashing lights + siren, rear-wheel drive |
| `armored_van` | ARMORED VAN | 6.0 m | 120 km/h | 4.2 tons, slow to speed up, shrugs off crashes; used in a mission |
| `chrome_supercar` | CHROME SUPERCAR | 4.6 m | 230 km/h | the fastest; `NITRO` button with a blue flame, turbo whoosh |
| `patrol_boat` | PATROL BOAT | 8 m | 75 km/h | floats at the beach of Neon Mile; bobs, leans, leaves a wake |
| `drone` | DRONE | 1.8 m wide | 70 km/h | flies up to 150 m high |
| (made in code) | STREET BIKE | 2.1 m | 235 km/h | a sports motorbike; leans into corners, stands on a kickstand - see "version 6.1" below |

The loader (`src/vehicles/vehicleLoader.js`) looks for `<name>.glb` (detailed) and
`<name>_lo.glb` (light version). A missing file is skipped, the game still starts. A plain
one-piece model also works: it is centered, set on the ground, turned so its long side points
forward and scaled to the length in the table. All the numbers (mass, drive, top speed, grip,
armor, engine sound) are in `VEHICLE_SPECS` at the top of that file.

Notes about the files in this repository:
- They are the six scans from the earlier "car models" update under the new names. Those were
  already rebuilt with separate wheels, doors and glass, so wheels still turn and doors still
  open. (A one-piece model would only pitch, roll and bounce.)
- There is **no drone model file**. The drone is built in code. Put `drone_lo.glb` into the
  folder and it is used instead.
- The boat only has a light version.

**The garage.** One of each vehicle is parked at the curb next to the start point (the drone
on the sidewalk, the boat at the beach south of the start street). A name tag floats over each
when you are close. The green ring on the road next to them is the **repair point**: drive a
damaged car onto it. The `CARS` button puts any vehicle in front of you.

### How driving works (`src/vehicles/physics.js`)

The physics runs in fixed steps of 1/60 s. Only your own car uses the full model:
- **Engine and gearbox:** a torque curve, 6 gears that shift by themselves with a short pause,
  an RPM value, engine braking and a rev limiter.
- **Weight:** mass, drive type (front, rear, all wheels). Braking puts weight on the front
  wheels, speeding up on the rear ones; the body dips, lifts and leans.
- **Tires:** each axle has a grip limit. Too fast into a corner: the car pushes straight on.
  Too much gas in a rear-wheel-drive car: the tail steps out. The handbrake starts a drift.
- **Surfaces:** dry road = full grip; rain = clearly less grip and longer braking; sand at the
  beach = very little grip and it slows you down; sidewalks = bumpy.
- **Crashes:** a light touch scrapes along with sparks. A hard hit stops the car quickly, turns
  it a little, shakes the camera and adds damage. Hitting a traffic car makes it stop and honk.
  Cars cannot get stuck inside walls.
- **Damage:** the paint gets darker in three steps, the glass cracks after strong hits, the hood
  smokes when the car is badly damaged, and a very damaged car is slower.
- **Driving assist** (`ASSIST` button): Off = wheels can spin and lock; Normal = traction control
  and ABS; Easy = also holds back the steering at speed so the car is hard to spin.

Police chasers use a much simpler model, traffic cars drive on rails.

### What you see and hear

- Lamps are glowing dots at the front and back of each car's box: headlights, tail lights,
  bright brake lights, white reverse lights, blinking orange indicators (they switch on by
  themselves in slow, tight turns), high beam. A soft patch of light lies on the road in front
  of your car at night. Police cars flash red and blue; at night one real lamp lights the street.
- Tire smoke, sand dust, spray on wet roads, sparks, crash debris, exhaust puffs at engine start
  and gear changes, hood smoke, boat foam. Skid marks stay for half a minute and fade.
- The view gets wider with speed, the camera hangs back a little and shakes on rough ground;
  on Medium and High the picture edges blur at very high speed.
- Cockpit and hood view in rain: drops on the windscreen and a wiper.
- Sound is still made in code: every vehicle has its own engine tone that follows the RPM, plus
  gear click, turbo whoosh, tire screech, wind, road rumble (different on sand and wet roads),
  suspension thump, brake squeal, scrape and crash, door, indicator tick, horn, siren. In the
  cockpit view the outside sounds are muffled.
- Dashboard at the bottom: speed, gear, RPM bar (red near the limit), nitro bar, damage bar,
  turn arrows.
- Phones that support it vibrate on crashes and bumps.

### Traffic, people, police

- Traffic cars honk when you block them, steer a little around things at the edge of their lane,
  pass a badly damaged car slowly, and pull over to the right and stop for a siren.
- People jump out of the way of a fast car. If you still hit one they fall on their back and get
  up again after a moment.
- **Wanted level:** ramming traffic or parked cars and knocking people over raises it (0 to 5
  stars, top-left). From 2 stars a police car comes after you, from 4 stars two. It cools down
  when you keep out of trouble. Stop next to a police car for a few seconds: "busted", the stars
  are gone.
- Second mission "The Armored Run" starts after the first one: bring the armored van to the garage
  before the time runs out.

---

## Automatic character rig (version 2.2)

The models in `assets/characters/` are plain meshes in an A-pose without a skeleton. When the
game loads, `src/characters/autoRig.js` builds one (about half a second on a computer; it runs
once and shows on the loading bar):

1. **Joints from the shape.** The mesh is cut by planes 1 cm apart (level cuts for body and
   legs, cuts across the arm for the arms). Each cut gives the outline of the body there; a
   joint is put at the **center of that outline**. Elbow, knee, wrist and ankle are moved to
   the thinnest outline near the place where a body normally has them. The gaps between the
   legs and between arms and body give the crotch and the armpits.
2. **Bones** (64): hips, 3 spine bones, neck, head; per side collar bone, upper arm + twist
   bone, forearm + twist bone, hand, 5 fingers with 3 bones each, thigh, shin, foot, toe; and
   helper bones at shoulder, elbow, hip and knee. Bones never scale and never change length.
3. **Check.** Every bone length and the rest angles are logged. Left and right are compared:
   more than 3 % apart and the side whose joints were found more reliably is mirrored.
4. **Skin.** Soft blends about 7 cm wide at the joints, exactly one bone in the middle of a
   limb, rigid head, hands and feet. Leaks are blocked with rules and with the distance along
   the mesh surface (a leg never follows the other leg, the jacket next to the arm does not
   follow the arm). Smoothed 3 times over mesh neighbours, at most 4 bones per point, weights
   under 0.02 dropped.
5. **No collapsing joints.** Shoulder, elbow, hip and knee each have a helper bone that turns
   half as far as the limb and moves a little to the outside of the bend. This does what
   "dual quaternion" skinning is used for, with normal skinning.
6. **Self-test.** Every joint is bent through its range and the volume of the mesh around it
   is measured. More than 12 % change is a WARN. WARN joints are repaired automatically (other
   helper strength, narrower or wider soft zone) and tested again, up to 3 rounds. The table
   is printed in the browser console and shown on the rig test screen.

`src/characters/proceduralAnim.js` moves the skeleton. There are no animation files:
- **Walk and run** with the phases contact, down, passing, up: heel first, roll to the toes,
  toe-off; hips turn and tilt, the spine turns against them, arms swing opposite to the legs
  with the elbows a little late, the head stays level.
- **Feet do not slide:** a foot on the ground stays at its place in the world while the body
  moves over it. Feet follow curbs and slopes, knees point where the foot points, the body
  sinks when the feet are far apart.
- **Joint limits** in degrees: elbow 0 to 150, knee 0 to 140 (backward only), hip -30 to 120
  forward and 45 sideways, shoulder 170 forward and 160 sideways, wrist -70 to 80, ankle -20 to
  40, spine 25 per bone (`LIMITS` at the top of the file).
- **Idle:** breathing, weight shifting from foot to foot, slow looks around.
- **Driving:** the player really sits in the driver's seat with the hands on the wheel.
- Changes between poses blend over about 0.2 seconds.

**Rig test screen** (`rigtest.html`, or the `RIG TEST` button): pick any of the 11 characters,
show the A-pose, arms forward 90 degrees, a deep knee bend with elbows bent 120 degrees, run,
walk, idle and the driving pose; switch on the skeleton, the weight colors and the wire view.
Drag to turn, pinch to zoom. Tap the result box for the full PASS / WARN table.

Result for Nate Calloway: 10 PASS, 2 WARN (both hips, +13 to +15 % volume when the leg is
lifted 45 degrees to the side - the trousers stretch between the legs).

What is not perfect:
- The hands of most models are small closed blobs. Finger bones are always built, but on those
  models the hand is one rigid block and finger poses do not show.
- Jackets, coats, backpacks and straps are part of the one mesh: they bend with the body and
  have no cloth movement of their own (the spring bones were skipped).
- Models with a long coat or skirt hide the legs: hips and knees are then placed from normal
  body proportions and the coat stretches in a deep bend.
- Other people in the city are still the simple instanced figures; only the player uses the rig.
- With `assets/characters/Nate_Calloway_rigged.glb` (a model with a real skeleton and idle /
  walk / run clips) that file is used instead and the automatic rig is skipped.

### Faces (version 4.1)

Three things made faces look bad, and each has its own fix. All of it happens when a character
is loaded; the model files in `assets/characters/` are never changed.

1. **A face that stretched when the head moved.** The skeleton put the start of the head at
   the narrowest part of the neck, which on these models is 5 to 9 cm ABOVE the chin. So the
   mouth, the cheeks and the nose were pulled half by the neck and half by the head. Now
   `autoRig.js` finds the chin on the front of the model (the place where the outline jumps
   forward from the neck to the jaw) and everything from the chin up follows the head bone
   ONLY. The neck joint sits below the chin. A face keeps its shape in every pose.
2. **Black rings and smudges.** The models come with one picture, and light and shade are
   already painted into it. Nate had black rings around both eyes. `faceClean.js` lays the face
   out flat as seen from the front (colors and depth), finds the nose (the only narrow ridge),
   the eyes (the hollows beside the nose, then the row with the most contrast), the normal skin
   color (cheeks and forehead), and lifts what is much darker than that. Eyebrows, lashes,
   wrinkles, the eyeballs, beards, hair and the frames of glasses stay as they are. A face that
   was clean changes very little; only where the skin under the eyes is far darker than the
   cheek below it (painted rings) the hollows of the eyes are cleaned as a whole.
3. **Faces that went black at night.** The streets are dark, so a face became a black shape
   and hands looked like dark spots. `characterLook.js` gives every character a soft light
   that always comes from where the camera is (it costs no real lamp and no extra drawing),
   keeps the head matt (no more white wet-looking streaks) and halves the small painted bumps
   on the head. `main.js` sets the strength from the height of the sun.

| In `src/config.js` (`player`) | Meaning |
|---|---|
| `faceClean: 1` | 0 = leave the pictures as they are, 1 = normal, up to 1.4 = stronger |
| `fillNight: 0.3` | the characters' own light at night (0 = off) |
| `fillDay: 0.02` | ... and with the sun high |

To look at it: `rigtest.html?char=Nate_Calloway` (add `&clean=0` for the face as it is in the
file, `&fill=0.3` for the night light of the game, `&look=0` for the shiny head of before).

What is not perfect: the cleaning is a careful guess from the shape of the face, it cannot
repaint a face. Thin dark lines that were painted in stay (for example where a strand of hair
falls on the forehead). Nothing of this was seen on a real phone yet.

### Expressions (version 4.2)

The faces now change with the story. Because the models have no bones in the face,
`src/characters/faceRig.js` adds seven small ones under the head when a character loads:
`jaw`, `lid_L` / `lid_R` (upper eyelids), `brow_L` / `brow_R` and `mouth_L` / `mouth_R`
(the corners of the mouth). Where they go comes from the face reader in `faceClean.js`: the nose
(the narrow ridge in the depth of the face), the eyes, the line of the mouth and the eyebrows.
How much a point of the skin follows a bone depends only on where it is (soft hills around each
place), so the skin moves softly on every model; the frames of glasses and strands of hair that
stand out in front of the face follow only the head.

`src/characters/faceAnim.js` moves them:
- **Moods:** `neutral`, `smile`, `grin`, `smirk`, `sad`, `worried`, `afraid`, `surprised`,
  `angry`, `stern`, `doubt`, `tired`, `pain`, `asleep`, `shout`. Each is one line of numbers in
  `FACES` (eyebrows up / tilted, eyelids, corners of the mouth, jaw): add your own there. A face
  changes softly from one mood to the next.
- **Blinking** every 2 to 6 seconds, sometimes twice.
- **Speaking (version 4.3):** while a line is on screen the mouth of the speaker opens and closes
  in syllables, with a short pause between words, and the lips go round ("oo") or wide ("ee")
  now and then. The models have no inside of a mouth (the lips are one closed skin), so:
  the face reader finds the line where the lips meet, column by column; the jaw is cut sharply
  along that line (the lower lip goes with the jaw, the upper lip stays); and the shader in
  `characterLook.js` draws the stretched skin between the lips dark, like an open mouth. How far
  a mouth is open is worked out from the bones in the shader, so every person has their own
  mouth while all copies of a model share one material.
- **Sleeping** (the `lie` pose) closes the eyes by itself.

In the story data (`src/story/chapters/*.js`) a mood is one more word:

| Where | Example |
|---|---|
| a line: the face of the speaker | `{ who: 'theo', text: 'p.tired', mood: 'tired' }` |
| a line: the faces of the others | `{ who: 'wren', text: '...', moods: { nate: 'sad' } }` |
| a person appears / changes | `{ do: 'actor', id: 'mace', ..., mood: 'stern' }`, `{ do: 'actorSet', id: 'mace', mood: 'smile' }` |
| Nate | `{ do: 'player', mood: 'afraid' }` |
| several at once | `{ do: 'mood', set: { nate: 'surprised', mace: 'afraid' }, seconds: 0.1 }` |

A face keeps its mood until the story changes it; every mission starts with a calm face for Nate.
The prologue and Chapter 1 now use moods in all their scenes (Theo tired and worried in the car,
Mace stern and caring, Nate's pain at the voicemail, fear after the shot ...). The people of the
street moments in free roam have a mood too (the two who argue, the Guard ...).

Rig test screen: the buttons `FACE SMILE SAD ANGRY AFRAID SURPRISED TIRED DOUBT` and `TALK`
(the mouth speaks until you tap it again).
`rigtest.html?facerig=0` shows a stiff face as before.

What is not perfect: these models are scans with only 200 to 500 points in the whole face, so
the expressions are kept moderate - bigger moves tear the painted picture. Beards hide most of a
mouth. There is no lip sync to real words (there are no voices), the eyes do not look around
(they are painted on), and the extras (dark copies of one body) have no picture, so their faces
are hard to read.

### Theo's new face (version 4.4)

Theo's model was generated **laughing**: the mouth 13 mm open with the teeth showing, the lower lip
pulled down, the corners and the cheeks up. Expressions are added to the face a model comes with,
so a laughing model could never look sad. So he got a new, calm face, made in code by
`src/characters/faceSculpt.js` every time he loads (the model file itself is not changed):

1. the lower edge of his open mouth was measured on the model and written into the recipe
   (`SCULPT` at the top of the file); the upper edge is found by itself;
2. the opening is squeezed to one line: the upper lip comes down a little, the lower lip and the
   chin come up (like a jaw that closes);
3. the corners of the mouth come down 3.5 mm, the cheeks 2.2 mm down and a little back;
4. the teeth in the picture are painted the dark color of the line between closed lips, and the
   painted laugh lines from the nose to the mouth are softened;
5. the light directions of all moved points are worked out new.

Then the face is read again and rigged like every other face: his calm face is the new "neutral",
and worried, sad, tired, afraid, stern, smiling and speaking all work on it. A little of the laugh
stays in his eyes and the shading of his cheeks (it is painted into the picture).
`rigtest.html?char=Theo_Calloway&sculpt=0` shows the old laughing face. The same recipe can calm
any other laughing model: measure its open mouth and add a line to `SCULPT` (only models with
teeth really showing are changed, so a new calm model of Theo is left alone).

### Replacing a character model

Every character is one file in `assets/characters/` (for example `Theo_Calloway.glb`). Put a new
file with the same name there and the game uses it: the skeleton, the face bones, the cleaning of
the face and the expressions are all made automatically when it loads. A new model should be:
- one person in the **A-pose** (arms out and down, legs straight), standing, looking forward;
- a **calm face with the mouth closed** (the game makes the expressions);
- one mesh with its colors in a picture (GLB with a base color texture); about 20 000 to 40 000
  triangles; any size (it is scaled to 1.8 m).

Generators that make such files from a picture (Tripo, Meshy and similar) are the quickest way;
give them a front picture of the old character and ask for the same person, same clothes, calm
face, mouth closed, A-pose. After the swap, open `rigtest.html?char=Theo_Calloway` and look at
the PASS / WARN table and the face buttons.

### Faces that looked thin or fat (version 4.2)

That was the camera, not the faces. A wide lens stretches everything near the edges of the
picture: people at the sides of a very wide phone looked fat, and on an upright phone the film
scenes showed only a thin slice of the picture, so faces filled the whole screen. Now:
- the view left-right is never wider than 90 degrees (`camera.maxHFov` in `config.js`);
- on an upright phone a film scene opens its view until the middle of the designed picture fits
  across the screen, and the black film bars get taller (`src/story/director.js`, `index.html`).

---

## The story (version 4.0): Prologue + Chapter 1

**Port Meridian, 2090.** A drowning coastal city where it rains almost every night. A serious,
grounded crime story: *is keeping someone alive always love, or is letting go sometimes love?*
Everybody in it lies to protect somebody. Feelings are shown through things and actions - a
mixtape, a photo that lies face down, a sticker that says 80, two short honks.

The game opens on a **title screen**: `CONTINUE`, `NEW GAME`, `MISSIONS`, `FREE ROAM`, `SETTINGS`.
The story saves itself at every checkpoint (the start of every mission, and the middle of the long
ones). After a failed mission, `TRY AGAIN` starts at the last checkpoint.

### All missions, and how to start each one

Every mission can be started in two ways: title screen -> `MISSIONS` -> tap its name, or with the
address option in the last column (add it to the end of the game's address).

| # | Mission | What happens | Address option |
|---|---|---|---|
| P1 | **ON THE GRID** | Four years ago, Ironhill Highway, 02:40, rain. In the car with your brother Theo. He changes the track on his mixtape; you tell him to leave it. Roll up to the second row (steering). Theo honks twice. | `?story=prologue.0` |
| P2 | **IRONHILL NIGHT RUN** | The race: stay with the pack, pass the trucks, catch the leader (nitro), brake and drift onto Neon Mile, flat out to the lights. "Do not slow down, Nate." The last turn. | `?story=prologue.1` |
| P3 | **TRACK 7** | The wreck. The tape plays to the end of track 6; track 7 is only hiss. Theo's phone is still lit: you may read it (it is never asked for). | `?story=prologue.2` |
| 1.0 | **HOME** | Four years later. Nate's flat over Mace's garage; WREN wakes him; an old saved message (choice). Downstairs: Mace, a sandwich (choice), Theo's car under a tarp. Get in the van: limiter 80. | `?story=chapter01.0` |
| 1.1 | **THREE DELIVERIES** | Halden Row, Vance Street, then a late pick-up at the east depot and a run down Neon Mile against the clock while everybody passes you. | `?story=chapter01.1` |
| 1.2 | **N. CALLOWAY** | A priority job with Nate's name on it. He switches the tape off: a silent drive, no objective on the screen, only the map. | `?story=chapter01.2` |
| 1.3 | **THE PICK-UP** | Dr. Solberg: "You look like him." One shot from a roof. In her hand: a race ticket (take it or leave it: choice). | `?story=chapter01.3` |
| 1.4 | **TWO HONKS** | A black Phantom turns into the backstreet without a sound, and honks twice. WREN: "Go. Now." The big `LIMITER OFF` button. | `?story=chapter01.4` |
| 1.5 | **THE CHASE** | Out the far end, the beach road, north at the lights, under the rail line. Two Meridian Guard cars (two stars). The Phantom stays in your mirror and never takes you. | `?story=chapter01.5` |
| 1.6 | **IT LET YOU GO** | Hide in an alley. It stops at the end of the street, then drives away. "Why?" (choice). The ticket, then the tape. End card. | `?story=chapter01.6` |

Mission types the engine knows: go to, drive to, timer, enter, leave, wait, talk, collect, follow,
chase, evade, wait for something, and the limiter moment. Every one of them has its objective in
the HUD, a floating marker, a beam of light in the world and a GPS line on the map (quiet moments
hide the objective on purpose).

### Choices and flags (they are saved, later chapters can read them)

| Flag | Set when |
|---|---|
| `voicemail_played` | Nate listened to the first four seconds of Theo's last message |
| `mace_kind` | Nate answered Mace kindly ("Eat something.") |
| `nate_name_known` | the priority job was addressed to "N. Calloway" |
| `ticket_found` / `ticket_taken` | Nate saw the race ticket / took it with him (if he left it, the radio news finds it for him at the end) |
| `limiter_off` | Nate switched the limiter off |
| `wren_tracks_zero` | at the end Nate said "Keep it in my mirror." |
| `phone_read` | the player read the message on Theo's phone (prologue) |

### How to add Chapter 2 (only a data file)

1. Copy `src/story/chapters/chapter01.js` to `src/story/chapters/chapter02.js`.
2. In it set `id: 'chapter02'`, `number: 2`, and write your missions (`setup` = what is in the world,
   `steps` = what happens). The top of `src/story/engine.js` lists every step, place and condition.
3. Put the new texts into `src/story/strings.js`.
4. Give the lines their moods (`mood: 'sad'` ..., see "Expressions" above): faces then follow the scene.

That is all: the engine looks for `chapter02.js` by itself. When it exists, the end card of
Chapter 1 shows `NEXT CHAPTER` instead of "CHAPTER 2 IS LOCKED", `CONTINUE` goes on with it and
its missions show up in the `MISSIONS` list. (While it does not exist, the browser console shows
one harmless "404" line for it.)

**Translating:** all texts are in `src/story/strings.js`. Copy the `en` block, give it another
language code, translate the right-hand sides and set `LANGUAGE`.

### Pause, settings, sound

- `II` (or `P` / `Esc`): **Resume, Settings, Restart mission, Title screen**. The game also pauses
  by itself when the phone is put away or another app comes up, and its sound stops.
- Settings: graphics level, button size (S / M / L), tilt steering, subtitle size, sound on / off,
  volume. They are remembered on the phone.
- All sound is made in code (`src/audio/music.js`): the mixtape "DON'T SKIP" (six lo-fi tracks;
  track 7 is empty on purpose), rain (on the street, on a roof), traffic hum, far sirens, waves
  near Neon Mile, a low pad for the chase, a heartbeat before the limiter moment, and silence at
  the moments that need it.

### What was built for it

- **Mace's garage** on the start street (a real building: an open repair bay with Theo's car
  under a tarp, and Nate's room above it), lamps and lane markings on Ironhill Highway.
- **Story people** load only when their chapter starts; their skeleton is worked out in the
  background. Poses made by code: asleep on the side, sitting on the edge of a bed, fallen,
  arms crossed, hands on hips, holding, carrying, looking at a phone, aiming. Hands and feet are
  placed ON things (thighs, hips, the bed, the ground) with the same arm and leg solver the
  walking uses, so nothing floats. You can look at every pose in the `RIG TEST` screen.
- **Computer drivers** (`src/story/drivers.js`): racers that keep a race close, the black Phantom
  that follows your own line (late on the brakes, wide on the way out), Meridian Guard cars,
  impatient cars that overtake a van that is stuck at 80.
- **Street life in free roam** (`src/ai/streetLife.js`): two people arguing under an awning, a
  Meridian Guard car that has stopped somebody, a woman on the phone in a doorway, two neighbours
  talking about the sea wall, a delivery drone. None of it is about the player; walk past and you
  overhear a line. Each moment is one entry in a list and only exists while you are near.
- **Performance:** story assets load lazily, the chase limits traffic to 15 cars and uses the
  one-mesh versions of the other cars.

## Chapter 2: WANTED (version 5.0)

The morning after Chapter 1. Nate is wanted for Dr. Solberg's murder: the city has his face on
posters and street screens, Guard drones speak from the sky, the news line at the bottom of the
screen says **NATE CALLOWAY, WANTED FOR MURDER** (with his face: a picture the game takes of the
character model itself). Same tone as before: rain, quiet, short lines, feelings through objects.

### The missions, and how to start each one

| # | Mission | What happens | Address option |
|---|---|---|---|
| 2.0 | **LEARN THE RULES** | A flooded car park, three stars, WREN's calm voice. A drone passes. Then get out of the search area (the yellow circle) and hide in an alley until a star goes. WREN explains each rule the first time it happens: seen, searching, drones, gates, hidden. In this lesson the Guard chases but does not ram. | `?story=chapter02.0` |
| 2.1 | **PRESS CONFERENCE** | A short film scene: Captain Sloane Harrow at a podium in The Crown. Her phone rings in the middle of a sentence: IVY, a little girl's picture. "Mama will talk later." On her patrol car's dashboard, a child's drawing. Back to Nate in the alley. | `?story=chapter02.1` |
| 2.2 | **MACE'S GARAGE** | Drive through The Grid to the garage without being seen; the main roads have scanner gates, the yellow line takes the side streets. Mace opens the door without a question. A hot drink (if you were kind to him in Chapter 1) or only a nod. "Did you do it?" (choice). The paint shop: pick one of 4 colors, hold to spray, a new number plate. | `?story=chapter02.2` |
| 2.3 | **THE CORNER OF THE GARAGE** | A quiet moment. Walk to the covered car at the back. "Don't touch that." The camera stays on the cloth. No music. | `?story=chapter02.3` |
| 2.4 | **THE CASE** | Solberg's case on the work bench: a chip called KEYSTONE. One video opens: a white room, Theo with a bandage on his wrist, dated three months after the crash. "Nate, if you're watching this, I didn't die the way you think I did." The rest is locked. Tell Mace, or keep it (choice). | `?story=chapter02.4` |
| 2.5 | **TWO HONKS** (optional) | Mace has a short story about the first time Theo honked twice outside the garage. Listen, or not tonight (choice). | `?story=chapter02.5` |
| 2.6 | **TRACK 7** | Night. Lift a corner of the tarp, or leave it covered (choice). Nate sits in Theo's covered car and puts the tape in: the end of track 6, then the silence of track 7. Only the rain on the roof. End card. | `?story=chapter02.6` |

### The wanted system (`src/ai/wanted.js`)

- **Stars 0 to 5**, shown as a thin row of stars under the mission box, with a small label next to
  it: **SEEN** (red: somebody sees you right now), **SEARCHING** (they lost you and look where they
  saw you last), **HIDDEN** with a thin bar (a star is going away).
- **The Meridian Guard:** Guard cars (the police coupe and the tech patrol car) chase along the
  roads and ram from 3 stars; drones fly over the streets with a searchlight; from 4 stars there are
  **roadblocks** (two cars and barriers across a crossing ahead of you, or at the foot of the
  Ironhill ramp). At most 4 cars and 2 drones at once. No guns, no gore: chases, ramming,
  roadblocks and arrests only.
- **Seeing:** every car looks forward in a cone, a drone sees everything under the open sky around
  it. Buildings block the view (the game checks the line through the city's buildings). On the
  small map the cones are drawn (red when they see you), and the searched area is a yellow circle.
  While you are wanted the small map is a little bigger and zoomed out, so the cones can be read.
- **Hiding:** parked in an **alley** or a **garage** (Mace's repair bay, the old car park) and not
  seen: after **20 seconds one star goes**, then the next. In an alley the **COVER** button appears
  (parked, in the car): it pulls the car into the shadow and the drones cannot see it either.
- **Scanner gates:** green frames over the main roads (`scanGates` in `src/city/layout.js`). They read
  plates and faces: a wanted driver who passes under one is seen at once (the frame flashes red).
  While you are wanted the yellow GPS line goes around them, and around the searched area.
- **Disguise:** after Mace's paint shop the van has a new color and a new plate. The Guard does not
  look at it any more - unless you drive dangerously (ramming, knocking people over) or pass a
  scanner gate (the camera reads your face behind the glass).
- **BUSTED:** a Guard car stops right beside you while you stand still. No game over: a short line,
  a fine of 250 credits (you start with 1,500; it is saved), and the last checkpoint again. In free
  roam you pay the fine and drive on.
- **Free roam** uses the same system, gentler: one star (a bumped car) sends nobody yet, Guard cars
  come from two stars, drones from three.
- On the screen during a chase: a soft red and blue light at the edges of the screen (it breathes,
  it does not flash). In the music: a faint low pulse that grows with the stars and fades away while
  you are hidden. Drones buzz overhead and speak through a loudspeaker; the news screens and Mace's
  old radio murmur (voices made in code: what they say is in the subtitles).

### Chapter 2 choices and flags

| Flag | Set when |
|---|---|
| `harrow_ivy_seen` | the press conference was seen (Captain Harrow's daughter called) |
| `nate_denied` | Mace asked "Did you do it?": true = "No.", false = "I don't know." |
| `van_color` / `van_plate` | the van's new paint (0 night blue, 1 rust red, 2 moss green, 3 ash grey) and plate |
| `keystone_found` | the KEYSTONE chip and the video of Theo |
| `told_mace_video` | Nate told Mace about the video (Mace knows more than he says - it matters later) |
| `mace_story_heard` | Nate stayed for Mace's story about the two honks |
| `lifted_tarp` | in the last scene Nate lifted a corner of the tarp and looked at Theo's car |

Chapter 1's flags are used too: `limiter_off` (the van stays free), `ticket_taken` (who has the
race ticket: WREN and the news screen say it), `mace_kind` (the hot drink or the nod),
`wren_tracks_zero` (WREN: "I am still watching.").

### What was built for it

- **The old car park** (`g02` in `src/city/heroBuildings.js`, at the north end of the start street):
  two concrete levels, columns with yellow bands, dead tube lights, a closed ramp, and a ground floor
  half under black, mirror-flat water. No rain falls under a roof any more (the rain knows the
  roofs of the garage and the car park).
- **Mace's garage** got a roller door that really goes up and down, and the tarp over Theo's car is
  now a cloth that can be lifted at one corner (with the real car under it in the last scene).
- **The press set** in The Crown, **the white room** of the video, WANTED posters, street screens.
- New engine steps: `police`, `news`, `video`, `tarp`, `shutter`, `fill`, `paint`; new conditions
  `stars`, `starsOver`, `starsUnder`, `seen`, `hidden`, `searching`, `droneOver`; events `seen`,
  `starLost`, `gate`. They are explained at the top of `src/story/engine.js`.
- **Performance:** at most 4 Guard cars (they never load the detailed model) and 2 drones; the
  scanner gates are 3 instanced meshes for all of them; all posters are one instanced mesh.

### How to add the next chapter (only a data file)

The same as before: copy `chapter03.js` to `chapter04.js`, set `id: 'chapter04'`, `number: 4`, write
the missions, put the texts into `strings.js`. The engine finds it by itself; until it exists the end
card of Chapter 3 says "CHAPTER 4 IS LOCKED".

## Chapter 3: THE SUNK (version 7.0)

The next night. Mace has a plan: the KEYSTONE chip needs a hacker called **Static**, and the way to
her is through **The Sunk** - the old south-west quarter of Port Meridian, half under the sea.
Serious, quiet, rainy, grounded: short plain lines, feelings through objects (a key on a cork float,
a storm lantern, an old company badge, a tape put away in a pocket).

### The missions, and how to start each one

| # | Mission | What happens | Address option |
|---|---|---|---|
| 3.0 | **INTO THE SUNK** | Mace's garage at night: "The chip needs someone who knows how Phantoms think." He gives Nate the key to an old boat. Drive the van to **Rustwater Dock** (the west end of the street at z = -198). A quiet moment in the van with Theo's tape. Walk down the gangway, take Mace's rusty boat (60 km/h at most, a rough old motor) and go into The Sunk by water. The first sight of the drowned city: a slow film scene with only a soft pad. Follow the lanterns to the Tidewalker market and talk to Wick. | `?story=chapter03.0` |
| 3.1 | **THE TIDEWALKER TEST** | Wick wants a Guard surveillance drone from the roof of the Guard post on the south ring. **Choice:** go in quiet, or ask for a distraction (red flares at the sea gate pull the drones away). Stealth: the drones fly fixed paths and look forward in a cone, a Guard boat patrols, a loud motor is heard - hold **QUIET**. Up the steel ramp, over the rope walkway, take the drone, cut its link (**hack**, optional), back to the boat. If they spot you: a chase with at most 2 stars - lose them before you go back. Wick's answer depends on how you did it. | `?story=chapter03.1` |
| 3.2 | **STATIC** | Lena's flat behind a broken loading door. She lights a lantern. Dry, guarded. The chip goes into her reader - and the screen says what the Phantoms are (no music, a long look at the screen). Lena reads the driving code, goes quiet, looks at her old KVI badge. **Choice:** tell her about Theo, or not. She listens to WREN: "That part is not mine." | `?story=chapter03.2` |
| 3.3 | **THE RAID** | The Guard tracks Nate's HALO. **Hack:** hold the line while Lena cuts the tracker (failing it gives the Guard a fix: 3 stars instead of 2). Out over the roofs (stairs down to two lower roofs), a moment that nobody can change: Captain Harrow finds a little girl behind the crates and looks away. Down the fire escape, into the Tidewalker boat, a chase on the canals, and into the dark drain tunnel under the pump hall, where the drones lose you. | `?story=chapter03.3` |
| 3.4 | **THE COST** | Dawn. Lena's flat is wrecked, half of the ceiling down. She sits in the boat, soaked: "You cost me my home. Now you will pay me back." **Choice:** give her the chip, or keep it. | `?story=chapter03.4` |
| 3.5 | **INTO THE MIST** | The end picture: Lena looks at the Phantom code on her tablet while the boat goes away into the mist, the old badge swinging on its cord. End card. | `?story=chapter03.5` |

### Chapter 3 choices and flags

| Flag | Set when |
|---|---|
| `drone_method` | `'quiet'` or `'distraction'` (the drone test). Wick's line after it changes (and if you were chased: `test_chased`) |
| `drone_link_cut` | the drone's link was cut in time (the optional hack) |
| `lena_code_seen` | Lena read the Phantom driving code and went silent (it matters later: the code is hers) |
| `told_lena_theo` | Nate told Lena about Theo |
| `wren_locked_found` | Lena found the part of WREN that she cannot open ("That part is not mine.") |
| `tracker_cut` | the tracker hack in the raid was done in time |
| `harrow_let_girl_go` | Captain Harrow saw the girl behind the crates and let her go |
| `chip_holder` | `'lena'` or `'nate'`: who keeps the KEYSTONE chip (Chapter 4 reads it) |

It reads Chapter 2's `limiter_off`, `van_color` and `van_plate` (the van keeps its paint and plate).

### THE SUNK (`src/city/sunkPlan.js` = where things are, `src/city/sunk.js` = what is built)

- **Where:** south-west of The Grid, x 476..780, z -470..-86 (it replaced scenery that nobody could
  reach). The old streets are canals 2 to 4 m deep; the bottom is the old street (rubble, a road line,
  old cars, one sticking out of the water nose-down).
- **Layout:** a canal **ring**, three side canals (**Rustwater** from the city's quay, the **sea
  gate** out to the ocean, the narrow **market cut**), the Tidewalker **market** basin, the **drain
  tunnel** under the old pump hall, **Lena's flat** (a half-sunk warehouse on the north side), the
  **Guard post** (two low roofs, a ramp, a rope walkway, a drone pad) on the south ring.
- **The buildings:** about 170 old brick and plaster buildings standing in the water: dark, green,
  stained walls below the water line, sash windows above (real 3D windows close by), cornices, flat
  tar roofs with huts of salvaged sheets, patched solar sheets, antenna clusters and water tanks,
  plants in tubs, rusty balconies with laundry, boarded windows, car tires as fenders, rusty ladders,
  small boats tied up, boats people live on (with a little cabin and a lit window).
- **Bridges:** rusty steel truss bridges and sagging rope walkways between the roofs; strings of
  lanterns over the water (warm, some teal). Small lamps are small lights: every third lantern and
  stall bulb is a weak real light at night, their halos in the mist and their shine on wet boards are
  smaller and fainter than a street lamp's (a market full of them looked like a lit stage).
- **Collision:** every building is a box; pontoons, ramps and moored boats only stop boats; people can
  only walk where there is a deck (pontoons, gangways, ramps, stairs, the roofs that are meant to be
  walked on, Lena's floor). Where two decks lie over each other (a ramp over a pontoon) the one
  closest to the feet counts.
- **The water (`PG_CANAL` in `src/city/materials.js`):** dark and a little see-through when you look
  down, a mirror at a low angle; three moving normal maps, rain drops as small rings, foam along the
  walls, a **V-shaped wake** and churned water behind every boat (also small ripples where you walk
  on a pontoon), **glowing green-teal algae** in patches and as a faint film along the walls at night
  (a little brighter where a boat stirs the water), the lanterns mirrored and broken up by the waves.
  **LOW quality:** one normal map, no rain rings, no wake waves, no mist sheets.
- **Mist and rain:** in The Sunk the fog is 2.3 times thicker and a little green-grey, soft mist
  sheets drift slowly over the canals, and it always rains there. In the drain tunnel: a dark teal
  haze, still water, dim lamps, dripping.
- **The map:** the canals, the buildings, the pontoons (brown), the tunnel (dashed), the bridges are
  drawn on the small map and on the full-screen map ("THE SUNK"). **GPS for boats:** in a boat the
  yellow line follows the canals (the canal map in `sunkPlan.js`: `NODES` and `EDGES`); on foot in
  The Sunk the arrow points straight at the goal.

### The boat (`stepBoat` in `src/vehicles/physics.js`, `collideBoat` in `src/vehicles/vehicle.js`)

- It floats: it bobs on the waves (smaller waves in the canals), pitches and rolls, leaves a foam
  trail and a wake, throws a little spray. Walls, pontoons and other boats push it back **gently**
  (a soft thump, not a crash).
- **Mace's old boat:** rusty, a rough knocking motor, slower to pick up, never faster than 60 km/h.
- **Get in and out at a dock:** stand on a pontoon next to the boat and press the CAR button; to get
  out, stop next to a pontoon or a gangway and press EXIT (out on the open water: "Steer the boat to
  a dock to get out"). The beach still works for the free-roam boat.
- **QUIET (hold, key Q):** the motor turns to a low murmur, the boat goes slowly (42 % of its top
  speed) and leaves almost no wake. The Guard **hears** a loud motor within 24 m; the quiet one it
  does not hear. A boat that waits QUIET under a roof (the tunnel, a bridge) counts as hidden.
- **Phone buttons for the boat:** the arrows (or TILT) to steer, GAS, BRAKE (reverse), QUIET (where the
  handbrake is for cars), EXIT, CAM.
- **A passenger** (Lena) sits on the edge of the right side deck near the back, legs over the side, and rocks
  with the boat. The film cameras find her where she really sits.

### The Guard on the water and stealth (`src/ai/wanted.js`)

- In The Sunk the Guard comes in **boats** (at most 3; they follow the canal map and slow down for the
  corners) and **drones** (at most 2). Guard boats flash red and blue.
- **Sentries:** drones on a fixed path that look forward in a cone (the story puts them up; a soft
  searchlight cone and a pool of light show where they look).
- **Stealth:** before anybody knows he is there, a big label says **HIDDEN** (green). In a cone, or
  heard, it says **SEEN** / **HEARD** (orange) and a meter fills - faster the closer he is. When it is
  full he is **SPOTTED** and the chase starts. Out of sight the meter goes down again.
- The cones on the small map are never smaller than 26 pixels (they were 18).

### The hack (`src/story/hack.js`)

A grid of 4 x 4 round nodes that pulse. The path is numbered 1, 2, 3 ...: put a thumb on 1 and draw
the whole path in **one swipe** before the bar runs out (12 to 15 seconds; never more than 20). A wrong
node: a red flash and 2.5 seconds less. Failing is never a game over: the story gives a short
penalty (the drone calls home / the Guard gets a fix on you). Optional hacks have a SKIP button.
Story step: `{ do: 'hack', title, sub, seconds, length, optional, ok: [steps], fail: [steps], flag }`.

### The people and the sound

- **Lena "Static" Marchetti** (`Lena_Marchetti.glb`) with her old KVI badge on a cord;
  **Captain Sloane Harrow** (`Sloane_Harrow.glb`); Mace.
- **The Tidewalkers:** quiet people in salvaged clothes (a new look for extras: trousers, a coat with
  patches of other cloth, a scarf, a hood - one shader for all of them; the face keeps the body's own
  picture, and they get the same soft night light as the story people) on the pontoons and the roofs.
  They watch Nate go by, and the murmur of the market goes quiet when he comes close. Wick, their old
  man, at his table. A little girl draws a boat on a wall with chalk. A market boat drifts slowly
  through the basin.
- **Sound (all made in code, `src/audio/music.js`):** rain on tin roofs and cans, water dripping
  (much more in the tunnel), water slapping against hulls, the murmur of the market, a low hum of old
  pumps; a tense pad only in the raid; silence at the reveal; footsteps on wet boards.

### What was built for it

- New files: `src/city/sunkPlan.js`, `src/city/sunk.js`, `src/story/hack.js`, `src/story/propsSunk.js`,
  `src/story/chapters/chapter03.js`.
- New engine steps `hack`, `sunk`; `drive` can steer a **boat** along a list of places; `police` takes
  `boats`, `stealth`, `hear`, `sentries` and `patrol.boats`; new conditions `spotted`, `tunnel`, `boat`.
- Props: the boat key, the storm lantern (lit or not), the KVI badge, the chip reader, a screen with
  readable lines, Lena's tablet, the Guard's surveillance drone, crates, the chalk drawing, the floating
  market boat, the wreck of the flat, red flares.
- **Performance:** everything that does not move in The Sunk is added to the city's shared meshes (no
  new draw calls). New draw calls: the water (1), the mist (1), sunken cars (2), small boats (1), tanks,
  antennas and dishes (3), Lena's screens (2). Measured in the software renderer at MEDIUM: at night
  (when the chapter plays) 85 to 118 draw calls in The Sunk; in daylight, when the sun's shadow map draws
  the near things a second time, 129 in the market and 167 at Rustwater Dock, where the city starts (now and
  then, when the far shadow map is redrawn, one frame goes up to 194 / 245). The limit is 250. The same places
  in the city at night: 119 to 155, only 0 to 12 more than before Chapter 3. (The busy city centre in daylight
  was already at about 255 before Chapter 3: most of it is the shadows of the traffic cars.)

## Every door opens (version 6.0)

**Every door at street level in the whole city can be opened now - 559 of them.** Walk up to a
door (a shop door, the glass door of a lobby, a garage door) and the **ENTER** button appears; the
screen goes dark for a moment and you are inside. To leave, walk back to the door: **EXIT**.

Three houses were made by hand, after the player's reference pictures. Their doors are real wooden
doors with a small brass lamp over it (it glows at night, with a soft halo in the rain) that swing
open:

| Door | Where | Inside |
|---|---|---|
| Halden House | the two round villas right next to the start point (both doors) | a dining kitchen and, through a doorway, a child's room |
| Flat 3B | the garden building, first corner south of the start (its lobby door) | a retro kitchen |

**All the other doors** get a room made by the game itself (`src/interiors/generate.js`), the first
time you open them. What is behind a door depends on the building and the part of town:

| Kind | How many | Inside |
|---|---|---|
| Flat | 261 | a living room: sofa with pillows, TV, coffee table on a rug, bookcase, armchair, floor lamp, a small kitchen with a fridge, a table for two by the window, pictures, plants |
| Café | 103 | a counter with a coffee machine and a glass case of cakes, a menu board, small round tables with bistro chairs, shelves of mugs |
| Corner shop | 66 | shelves you can walk around (boxes, tins, bottles), glowing drinks fridges, a counter with a till |
| Lobby | 102 | letter boxes, two lift doors, a reception desk, a bench, big plants |
| Office | 18 | desks with glowing screens, office chairs, filing cabinets, a water cooler, a whiteboard |
| Garage | 6 | a work bench, tools on the wall, shelves of boxes, old tires, an oil drum |

The Grid has mostly flats (and some shops and cafés), Neon Mile cafés and shops, The Crown offices
and lobbies. Each room is built from the door's own number: the same door always opens into the
same room, and no two are quite alike (sizes, colors, which side the kitchen is on, the furniture).
At most three made rooms are kept in memory; the oldest one is thrown away.

**The rooms (made like the player's reference pictures):**

- **The dining kitchen** (picture 1): ochre plaster walls, a dark wooden ceiling with beams, blue and
  cream patterned floor tiles, a cream enamel stove with a red pot and a kettle, a blue tile panel
  behind it, a sink under the window with a dish rack, copper pans on a rail, jars on shelves, papers
  pinned over a work table with crates of onions and potatoes, a big dresser with plates and cups, a
  radio and a candle, a table with plates, cups, a teapot, a green bottle and flowers, three
  spindle-back chairs, a green enamel lamp over the table, a coat by the door, a plant in the corner.
- **The child's room** (picture 3): wallpaper, a wooden plank floor, a red patterned rug with a board
  game and a ball, a bed with a grey blanket, a wardrobe, a desk with a lamp and drawings, a cork
  pin board with notes and a map between two little blue shutters, shelves with books, a globe and a
  teddy bear, an armchair by the window, orange curtains, a fan, a toy box, posters.
- **The retro kitchen** (picture 2): a round cream fridge with notes on it, a mint green stove,
  wooden cupboards with drawers, cream wall tiles with a green border, a checkered floor, open
  shelves with mugs and jars, a kitchen scale, plants, thin white curtains glowing in the sun, a
  small table with two red chairs, a clock and a calendar.

**The light follows the game's clock:** by day the sun comes through the window - a real light with
shadows (the window bars draw lines on the floor), a soft beam in the air with slow dust in it, warm
light bouncing back from the floor. In the evening the sun is low and orange and the lamps go on. At
night: cold moonlight through the window, warm lamps, dark corners. The picture outside the windows
changes from day to evening to night too.

**How it works:** the houses are not inside the city's buildings - they are built far away from the
city (and while the game loads, so the first visit is quick). Inside, the camera only draws the house
and the player, so the city costs nothing. The street keeps living around the door (traffic, people,
the Guard) and is all there when you come out. Inside nobody can see you: **the Guard loses you and
the stars go down** like in a hiding place - but you cannot go in while a Guard car is looking at you.
Doors work in free roam and in quiet story moments (not during film scenes or locked moments); if a
film scene of the story starts, the game puts you back at the door first.

**To add a house made by hand:** write a function like `buildFlat` in `src/interiors/rooms.js`
(walls, holes, furniture), give it a place in `ORIGINS` (`src/interiors/interiors.js`) and the names
of its doors in `HOUSES`. A door of a hero building gets a name with `markEntrance(...)` in
`src/city/heroBuildings.js`. **To change the made rooms:** the templates are at the end of
`src/interiors/generate.js` (one function per kind), `kindOf()` decides the kind of a door.

**Outside too (picture 4):** every street lamp now has a soft halo in the air at night (much bigger
and stronger in the rain, when the air is full of water), and in the rain each lamp is mirrored on
the wet road as a long, rippling streak of light that runs toward the camera. Two extra draw calls
for the whole city.

---

## Fixes, detailed wheels and a motorbike (version 6.1)

**Three things the player saw, and why they happened:**

| What you saw | Why | The fix |
|---|---|---|
| Some cars looked broken: wheels missing, holes in the wheel arches | the number that turns the wheels started as "nothing"; "nothing + a number" is not a number, so the wheels of the detailed car models were placed nowhere and disappeared | the wheel turn starts at 0, and a bad number is reset before it ever reaches a wheel (`src/vehicles/physics.js`, `vehicle.js`) |
| Parts of the character disappeared in some places | when a wall pushes the camera very close, the camera's "near cut" (20 cm in front of the lens) sliced through the body: an arm or half the head was cut away | when the camera comes closer than about 85 cm, the character now fades out smoothly (a fine dither) instead of being cut; going through a door always shows the player again (`src/player/player.js`, `src/main.js`) |
| At night, windows showed a morning view | the window glass was a light grey, half see-through sheet that looked bright and milky; the moonlight through it was as strong as morning sun | the glass is now almost clear and dark, the moonlight is much weaker, and the picture outside gets darker in the evening, at night and in the rain (`src/interiors/kit.js`, `interiors.js`) |

### Detailed wheels (`src/vehicles/wheelDetail.js`)

Every wheel made in code is now built like the wheel of a good car model (the player's reference
pictures): a round tyre with soft shoulders, grooves and a ring on the side wall; a deep rim with a
dark barrel and a bright lip; spokes that dish inward to a hub with a cap and five wheel nuts; behind
the spokes a **brake disc with drilled holes** that turns with the wheel; and a coloured **brake
caliper** that holds the disc and does NOT turn. The whole turning wheel is one piece (one draw call),
the caliper a second small one.

| Rim | On | Look |
|---|---|---|
| `twin5` | coupes (and any car made in code without its own) | five double spokes, silver, red caliper |
| `mesh10` | SUV | ten thin dark spokes, yellow caliper |
| `blade6` | sedan, van | six wide blades, black caliper |
| `bikeF`, `bikeR` | the street bike | spokes in the middle of the wheel, a red stripe on both rim edges, two ring discs at the front, one at the back plus the chain sprocket, gold calipers |

The car model files keep their own rims; a drilled disc and a red caliper are now added behind them,
so you no longer see through the wheel into nothing. A detailed wheel is about 3,600 triangles.

### THE STREET BIKE (`src/vehicles/bike.js`)

A sports motorbike, an original design of this game (no real make; the reference picture of a sports
bike was used for the level of detail only). It is the **first vehicle in the garage row** at the start
point, and the first in the `CARS` menu.

- **Body:** the panels are made as a "skin" through cross sections (like the hull of a boat): a sharp
  nose with two slim LED headlights and LED brows, a smoked screen whose edges lie exactly on the
  nose's crease lines, winglets, side fairings with slanted vents and a step line, a dark belly pan, a
  tank with a crisp shoulder line, a rider seat, a black pillion pad, and a tail that rises to a point
  with LED tail lights. Lights and vents are laid onto the curved panels, a few millimetres out.
- **Parts:** aluminium frame beams and swing arm, a red-spring shock, the engine and its covers (seen
  through the open back of the fairing), a chain, footpegs, mirrors with indicators, a glowing dash,
  a short titanium exhaust on the right, the number plate holder with indicators, a hugger over the
  back wheel.
- **The front turns** about a steering head that leans back (the "rake"): golden upside-down fork,
  triple clamps, clip-on bars with grips, levers and bar-end weights, the front fender.
- **It leans into corners** by the real sideways force (the angle a rider would need), up to about 40
  degrees. Nobody on it and standing still: it **leans on its kickstand**; the stand folds away when
  you get on.
- **The rider:** the player sits on the seat, leans forward over the tank, head up, knees at the
  tank, feet on the pegs, hands on the grips - the hands go with the bars when you steer. The cockpit
  view is from the rider's eyes (you see the dash, the screen and the mirrors). The chase camera comes
  closer for the bike.
- **Cost:** about 7 draw calls (body, front, two wheels with calipers, kickstand).

---

## Softer beds and wheels on every car (version 6.2)

| What you saw | Why | The fix |
|---|---|---|
| The bed looked bad, the pillow was not a pillow | Nate's bed (the start of Chapter 1) was made of five plain boxes: a hard white block as the pillow, a flat slab as the blanket | a real bed now: a low wooden platform on a dark plinth, a padded headboard with six channels, a mattress with a pale sheet, two puffy pillows with a sewn seam (Nate's has a hollow where his head lies) and a quilted blanket that hangs down the open side and the foot in folds, its top edge rolled back |
| Hands and feet went through things | in the sleeping scene the hand under Nate's face was inside the block pillow | the hand now rests on the bed in front of the pillow, the head lies in the pillow's hollow, the boots on the blanket. This was checked by measuring where the bones are, not only by eye |
| Some cars had no wheels | the light versions of the scanned cars (used for parked cars, traffic and cars far away) had broken wheels: the police coupe's were missing, the patrol car's hollow, the city car's smeared | when the game loads, the old wheel triangles are taken out and clean wheels made in code are put in their place (`cleanWheels` in `src/vehicles/vehicleLoader.js`). Four of the five models even got lighter: their broken wheels cost more triangles than the new ones |

**More detail:**
- The child's bed in Halden House got the same puffy pillow and a quilted blanket that hangs down both sides,
  tucked in at the foot, with a rolled top.
- Every sofa in the rooms the game makes has two soft throw pillows leaning on its back.
- Parked and traffic cars made in code have round tyres with rims and spokes (`makeLightWheel` in
  `src/vehicles/wheelDetail.js`) instead of nine-sided black discs.

**Soft things for later (`src/utils/softShapes.js`):** `pillowGeometry(width, depth, height, { dent })`,
`blanketGeometry({ w, l, drop: [left, right, foot], thick, quilt })` and `rollGeometry(length, radius)`
give a geometry that can go into any room (see `bed()` in `src/interiors/furniture.js`).

---

## Known limits

- Traffic cars drive on rails: when hit they stop and honk, but they are not pushed away. Parked
  cars are solid and do not move. Vehicles you left behind and police cars do get pushed.
- Car bodies do not get dents: damage is shown with darker paint, cracked glass and smoke.
- Not done from the wish list: the Doppler effect for passing traffic, mirror-like headlight
  reflections on wet roads and separate fog lamps (the wet road only gets the normal light patch).
  The cockpit is the same simple dashboard in every car, without working dials.
- The boat cannot leave the water; you get out at the beach or at a dock in The Sunk. The drone has no camera
  of its own and does not collide with trees or lamps, only with buildings.
- The police only chase by car; they do not get out and there is no shooting (on purpose).
- Chapter 2: the voices of the news screens, the radio and the drone loudspeakers are made in code
  and have no words (the words are in the subtitles). The press conference is seen without shadows
  (the shadows follow the player, who is far away in the alley at that moment).
- The new driving feel was tuned with numbers and a software renderer, not on a real phone - the
  grip, steering speed and button sizes will need a round of tuning after real play.
- The car model files were scans without an inside and without separate doors. Doors, glass and
  wheels were cut out by a script, so their edges are not perfect, and all cars share one simple
  interior. Only the driver's door opens. Parked and traffic cars keep dark, solid windows.
- Tested with a software renderer only; real phone frame rates, the feel of the touch buttons, tilt
  steering and the sound still have to be checked on a real phone.
- The player's movement is made by code, not by an animator: it is clean but simpler than hand-made
  animation (no turning on the spot animation, no jumping, the same walk for everyone).
- Every street door opens, but each building has one room behind its door (no stairs, no upper
  floors). Inside you can walk and look, but not sit, open cupboards or switch lamps yourself. The
  view through a window is a picture, not the real street. Only the three houses made by hand have
  a door leaf that swings; the other doors open behind the dark fade.
- THE STORY: it was played from start to end by a test robot in a software renderer, not by a person on a
  phone - timing of the scenes, the difficulty of the race and the chase, the size of the buttons and
  all sound still need a real play-through. The prologue runs about 3 minutes (not 4): the city is one
  kilometer wide. Faces do not move (no lip sync): people speak with a hand gesture and subtitles.
  The story people are the scanned models with an automatic skeleton: clothes do not swing.
  Extras (the two under the awning, the customer, the Guard
  officer) are dark copies of one body. The two story alleys are only 5 m wide: drive in slowly.
- Beds and blankets do not bend under a body: a sleeping or sitting character lies ON them. Bodies are posed by
  code, so a hand or a boot can still touch the cloth a few millimetres deep. Arms that swing while walking can
  still go into a wall when you walk right along it.
- THE STREET BIKE drives with the car physics: the lean is only for the eye. It cannot do wheelies or
  stoppies and does not fall over in a crash; it is not used by traffic or the story (yet). The rider's
  pose is made by code and was only checked in pictures from a software renderer.
- CHAPTER 3 / THE SUNK: nobody can swim - on foot you can only go where there is a deck, a roof that is
  meant to be walked on, or a stair. The rooms of the old buildings are not inside (only Lena's flat is).
  The Guard boats follow the canal map, so they can be slow in the narrow market cut. A passenger in a boat
  always sits on the right side deck near the back, legs over the side. The Tidewalkers are copies of one
  body with a shader outfit (clothes do not swing). On foot in The Sunk the GPS arrow points straight at the
  goal (only boats get a line along the canals). The water, the mist and the stealth were tuned in a software
  renderer only.
- Shop names, signs and adverts are invented. No real brands are used.
