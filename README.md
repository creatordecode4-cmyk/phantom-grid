# PHANTOM GRID

An open-world 3D web game set in **Port Meridian**, a fictional American coastal city in the year 2090.
A realistic city of the future: sculpted glass towers, hanging gardens, sky bridges,
electric cars and a maglev line. No cartoon look, no neon-toy look.

The story now runs from the Prologue to **Chapter 8, "Talk to Zero"** (version 11.0: a night highway in the rain, two
cars side by side, a voice from the radio - see "Chapter 8: TALK TO ZERO" below; Chapter 7 is not written yet, the
story steps over it). Chapter 6, "Old Debts" (version 10.0) is the quietest chapter: one garage, one night, Theo's car
rebuilt part by part. Since version 10.1 people speak with the **whole body**:
the hands, the chest, the shoulders, the head and the weight move with the words (see "Body language" below).

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
| Swim | walk into deep water: off a low pontoon in The Sunk, or down the beach into the sea. `RUN` = swim faster. Swim into a pontoon to climb out | same |
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
| `flags=a,b:c` | with `story=`: set saved flags for a test before the mission starts - a name alone is `true`, `name:word` sets a word (`true`, `false` and numbers are read as such). Example: `?story=chapter08.0&flags=dante_captured,juno_fate:spared` |

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
    proceduralAnim.js      moves the skeleton: walk (ten walking styles), run, idle, driving, foot placement, joint limits,
                           and the poses of the story (sitting, lying, arms crossed, aiming ...)
    rigWorker.js           works out a skeleton in the background, so the game does not stop meanwhile
    faceClean.js           reads a face (nose, eyes, mouth, eyebrows) and cleans painted dark rings and smudges
    faceRig.js             adds small face bones: jaw, eyelids, eyebrows, corners of the mouth
    faceSculpt.js          gives a model that was made laughing a calm face before it is rigged (Theo)
    faceAnim.js            moods (smile, sad, angry ...), blinking, the jaw while speaking
    speech.js              the words of a line -> the shapes of the mouth for each sound, timed to the subtitle
    characterLook.js       the characters' own soft light, a matt head, softer bumps on the face
  story/
    engine.js              THE STORY ENGINE: reads a chapter file and makes it happen (steps, objectives,
                           film scenes, choices, checkpoints, fail and retry). Its top explains every step
    chapters/prologue.js   THE PROLOGUE AS DATA ("LAST LAP")
    chapters/chapter01.js  CHAPTER 1 AS DATA ("RAIN DELIVERY")
    chapters/chapter02.js  CHAPTER 2 AS DATA ("WANTED")
    chapters/chapter03.js  CHAPTER 3 AS DATA ("THE SUNK")
    chapters/chapter04.js  CHAPTER 4 AS DATA ("CHROME WOLVES") - chapter05.js goes next to it
    strings.js             EVERY TEXT of the story and its menus (translate the game here)
    save.js                the saved game: chapter, mission, checkpoint, choices, unlocked characters
    actors.js              the people of the story: loading, poses, walking, sitting in cars, looking
    drivers.js             the computer drivers: racers, Zero, the Meridian Guard, impatient cars
    director.js            the camera of the film scenes
    props.js               the small things: mixtape, photo, ticket, phone, sticker "80", parcel ...
    propsWanted.js         the things of Chapter 2: WANTED posters, news screens, Guard drones, the tarp
                           over Theo's car, the roller door, radio, mug, KEYSTONE chip, number plate ...
    propsRace.js           the things of Chapter 4: Theo's jacket, the wolf on Dante's hood, food stalls,
                           soft holographic signs, the guardrail of the last turn, the jump ramp, the finish arch
  race/
    races.js               THE RACES AS DATA: routes, laps, rivals, crowds, the jump, the shortcut, the last turn
    raceLine.js            the racing line and the fastest safe speed at every meter
    rivalAI.js             a computer driver (same physics as you): line, brakes, passes, blocks, mistakes
    raceManager.js         a race: grid, countdown, checkpoint gates, places, laps, rubber band,
                           slipstream, drift boost, jumps, replay, RETRY / SKIP
    raceHud.js             the race screen (place, lap, time, gauge, countdown, RESTART, result cards)
    spectators.js          the crowds along the course (one draw call), phone lights, cheering
  ai/
    zero.js                ZERO: follows you in free roam after Chapter 4; the strike in the final race
    traffic.js             the other cars: lanes, traffic lights, turns, braking, honking, pulling over,
                           never into another car
    roadSense.js           what a computer driver sees: keep to the right half of the street, slow down
                           behind the car in front, drive round a car that stands still when the way is
                           free (the Guard cars, the pursuers of the story)
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
    water.js               where the water is and how deep (the canals of The Sunk, the sea): who is in deep water swims
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
- the view left-right is never wider than 82 degrees (`camera.maxHFov` in `config.js`; it was 90 until version 9.1);
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

## Swimming (version 7.1)

**Nobody stands on the water any more.** Whoever is in deep water swims - Nate, the story people and every
other character.

- **Where:** the canals and the market basin of The Sunk (3.2 m deep), and the sea. Down the beach the water
  gets deeper slowly: up to the knees Nate walks normally, deeper he walks slower (the water pulls at the legs),
  and from 1.3 m on (chest deep) he swims. He can swim about 45 m out past the end of the beach.
- **Going in:** walk off a pontoon or the foot of a ramp. A roof edge, a stair or a bridge still stops him
  (nobody jumps off a roof).
- **Getting out:** swim into a pontoon (or into a low step) and he climbs onto it. Walls of houses stop him.
- **No accidents at the cracks:** where two decks meet with a gap of a few centimeters (the end of a stair and a
  pontoon) he walks over it; stepping off the side of a stair onto the pontoon or the roof just under it (up to
  about two meters) he lands on that deck, not in the water under it.
- **How it looks** (`swimPose` in `src/characters/proceduralAnim.js`): standing still he **treads water** -
  upright, the head and the top of the shoulders out of the water, the hands sculling under the surface, the
  legs turning slowly like an egg beater. Moving, he does a **front crawl with the head up**: the body almost
  flat just under the surface and rolling a little, one arm pulling under the water while the other comes
  forward over it with a high elbow, the legs kicking fast and small with pointed toes. The two blend into each
  other by speed. Hands and feet are put in place by the same arm and leg solver as walking, so the joint limits
  hold.
- **Speed:** 1.2 m/s, 2 m/s with `RUN` (a person in clothes is slow in the water). Turning is slower too.
- **Camera:** it comes down to the swimmer's head and never goes under the water.
- **Sound and water** (made in code): a heavy splash going in, a softer one coming out or standing up, a slap
  for every stroke (a quiet lap when treading water), legs pushing through shallow water; white water at the
  hands, and in The Sunk the canal water shows his small wake.
- **Story people and other characters** (`src/story/actors.js`): an actor whose place is in deep water - put
  there by the story, or walking there - swims at the surface with the same animation; the name tag and the
  eyes go down with him.
- **On the RIG TEST screen** two new buttons, `TREAD` and `SWIM`, show both strokes on any character (with a
  see-through sheet of water at the surface).
- `src/world/water.js` answers "how deep is the water here?" for everybody: `city.water.at(x, z)` gives the
  surface and the bottom, `city.water.depth(x, z)` the depth. `SWIM` (1.3 m) and `WADE` (0.45 m) are at its top.

Mission 3.3 (the raid) got three fixes on the way:
- the markers over the roofs lead stair by stair (Lena's roof, the next roof, the fire escape landing, the
  pontoon); before, the marker pointed past a roof edge, into a 5 m drop;
- the film shot where Harrow sees the girl behind the crates was black: its camera looked into the wall of
  Lena's house. It now looks from the fire escape, over the water, down the pontoon: the girl, the crates, Harrow;
- the step "lose them in the old drain tunnel" had no marker once you reached the mouth of the tunnel; the
  marker now leads ten meters into it.

---

## Chapter 4: CHROME WOLVES (version 8.0)

Two nights later. The race ticket from Theo's last night says the host was **Dante Rios**, the leader of
the **Chrome Wolves**. Dante does not talk to people; he races them. And Nate needs a car fast enough to
chase Zero - only Dante has one. Serious, rainy, tense but human: short plain lines, feelings through
objects (a ticket under a lamp, a cloth over a car, a bottle of water poured on the road, a blue jacket).

### The missions, and how to start each one

Start any of them from the title screen (**MISSIONS**) or with the address option.

| # | Mission | What happens | Address option |
|---|---|---|---|
| 4.0 | **THE TICKET** | Quiet. Mace's garage at night: Nate holds the race ticket under the lamp; Mace sees it and says nothing. Lena (if she kept the chip) sits at the bench with her laptop: "Dante will not talk to you. He will race you." Nate asks for a car. Mace looks at the cloth over Theo's car: "Not that one." He gives him his old street car (a worn bronze body, quick, with nitro). Drive to Neon Mile. | `?story=chapter04.0` |
| 4.1 | **NEON MILE QUALIFIER 1** | A sprint through the city with a 3 minute clock (not last). It teaches the race screen (place, lap, checkpoint gauge) and the **drift boost**. | `?story=chapter04.1` |
| 4.2 | **NEON MILE QUALIFIER 2** | Three laps **in the rain**: a hairpin by the sea and a **jump** over the road works on the hill. | `?story=chapter04.2` |
| 4.3 | **NEON MILE QUALIFIER 3** | Four short laps through the **night market**: people on the road step back to the sidewalk when the cars come; **Rigg**, a Chrome Wolf, tries to push Nate into a wall. Only a win counts. | `?story=chapter04.3` |
| 4.4 | **FACE TO FACE** | Quiet. Dante arrives (a wolf engraved on the hood of his chrome car), wearing **Theo's old blue jacket**, a little small on him. "You have his eyes. You also killed him." **Choice** (with a timer - waiting is also an answer): say nothing, "I am sorry", or "Race me." | `?story=chapter04.4` |
| 4.5 | **IRONHILL NIGHT RUN** | Quiet moments on the grid: Nate wipes the rain off the windshield, Dante pours a little water on the road. Two laps: up the ramp onto the raised highway, round at the top, down again, and back to **the turn of the prologue**. **Choice:** the risky shortcut (the old diagonal: faster, but it hurts the car) or stay on the road. The last turn is only won on **Theo's line** (stay wide, brake late, cut in at the corner, run out wide); after two misses a faint ghost line shows it. Theo's voice: "Don't slow down, Nate." Then **Zero** comes out of the dark, passes Nate without touching him and stops every other car (they spin and stop, the drivers climb out), stands in front of him with its lights on, and drives away. | `?story=chapter04.5` |
| 4.6 | **THE ROOF** | Quiet. Dante's car smokes below. On a roof he takes off the jacket: "He did not come for the race, Nate. He was running from someone." **Choice:** hold out your hand for the jacket, or let him keep it. A long fade on the rain. | `?story=chapter04.6` |

### Chapter 4 choices and flags

| Flag | Set when |
|---|---|
| `mace_gave_car` | Mace gave Nate his old street car (4.0) |
| `dante_response` | `'silence'`, `'sorry'` or `'race'` (4.4). The Chrome Wolves' lines on the grid and Dante's lines on the roof follow it |
| `took_shortcut` | the old diagonal was taken in the final race (the car is hurt; Dante says so on the roof) |
| `zero_found_race` | Zero showed itself in the final race. **From now on, in free roam:** drive at full speed for more than 10 seconds and Zero can come out of the dark behind you |
| `jacket_taken` | Nate took Theo's jacket. From now on **he wears it** (in free roam and in the chapters after this one: it is painted over his own clothes, like Dante's), and a small sign of it is on the screen |

It reads Chapter 3's `chip_holder` (Lena is in the garage only when she kept the chip; else WREN speaks).

### The races (`src/race/`)

- **`races.js`** - only data: the route (points on the road network), laps, start grid, the five rivals (name,
  car, skill, aggression, nitro, a tuned car), the crowds, the jump, the shortcut and the last turn.
- **`raceLine.js`** - works out the **racing line** (outside - inside - outside through every corner) and the
  fastest safe speed at every meter (it brakes in time for the corners).
- **`rivalAI.js`** - a computer driver drives the **same car physics** as the player. It follows the racing
  line, brakes before corners, takes the slipstream, passes on the side with more room, **blocks** (aggressive
  drivers), **pushes** (the crew car in qualifier 3) and makes small **mistakes** (brakes too late, lifts off).
  **Rubber band:** a driver far ahead of you is a little slower, one far behind a little faster - a few
  percent only, so it never looks like cheating.
- **`raceManager.js`** - the race itself: the grid, **3, 2, 1, GO** (the engine revs with the gas pedal),
  invisible **checkpoint gates** that must be passed in order (cutting a corner misses one: "MISSED
  CHECKPOINT - GO BACK"), places, laps, **slipstream**, **drift boost**, **jumps**, the last 3 seconds again as
  a **replay** after the finish line, **wet roads** (in the rain the drivers brake earlier: less grip), and the
  result card. **WRECKED** or **LAST** (or not good enough): RETRY from the line; after two fails also **SKIP**.
  The parked cars of the city are taken off the race road; there is no traffic during a race. Race cars take a
  knock better than street cars (bumping is part of racing).
- **`raceHud.js`** - the race screen, thumb-safe: big place (2/6) at the top middle, the lap and the time, the
  gauge to the next gate, the countdown in the middle, a **RESTART** button on the left. Subtitles get a
  darker plate while racing.
- **`spectators.js`** - small crowds along the course in **one draw call**, with **phone lights** (one more
  draw call), red **flares** with smoke, and cheering when a car flies past (sound made in code).
- **Driving difficulty** (SETTINGS → DRIVING): EASY, NORMAL, HARD - changes the rivals' skill and how strong
  the rubber band is.

### Zero (`src/ai/zero.js`)

- **The proximity system** (free roam, after `zero_found_race`): full speed (140 km/h or more, or nearly the top
  speed of a slower car) for more than 10 seconds and a
  black car with one thin cold bar of light can appear about 100 m behind you, on your own track. It stays
  about 40 m back, never comes closer, never touches you (inside 32 m it can never be faster than you). The
  rear-view mirror comes up and shows its cold bar of light; a deep slow heartbeat is heard while it is near.
  Slow down below 80 km/h and it lets go: it brakes, its light goes out, it is gone (and stays away at least a
  minute and a half).
- **The strike** (the final race): it comes down the dark street, passes Nate close on his left, goes through
  the field behind him in slow motion (each car it touches spins and stops - no fire, no gore), stands in front
  of him with its headlights on, turns, and drives away.

### What was built for it

- Story engine (`src/story/engine.js`): new steps `race`, `raceEnd`, `slowmo`, `autoDrive` (the story brakes the
  player's car in a film scene), `zero`; the `choice` step takes **three** answers; a flag can be compared with
  a word (`{ flag: 'chip_holder', is: 'lena' }`); a prop can be laid on the hood of a car (`hood`); `say` can
  pick one of several lines; `music` has `zero` (the deep heartbeat).
- **Theo's jacket on Dante, later on Nate** (`src/story/actors.js`): the character models are one mesh with one picture, so
  clothes cannot be swapped. The jacket is **painted over** the body in the shader: chest, back and arms
  (from where the auto rig found the shoulders, elbows and wrists), the model's own folds kept as light and
  shadow, an open front, white stripes at the cuffs and the hem - and the sleeves end a little short.
- New things (`src/story/propsRace.js`): Theo's jacket (folded / hanging), the wolf engraved on Dante's hood,
  food stalls, soft holographic signs (with their streak of light on the wet road), the **guardrail** of the
  last turn (the same one now stands in the prologue), the jump ramp over the road works, the finish arch, a
  water bottle that pours, a rag, Lena's laptop, a stool, a column of smoke.
- **The last turn is the turn of the prologue**: the same corner, the same rain and hour, the same guardrail,
  and the same half second of slow motion at the brake point (added to the prologue too).
- Sound: the crowd murmur and cheers, two more engine voices for the nearest rivals, the deep slow heartbeat
  for Zero, silence in the last turn and on the roof.
- **Draw calls** (MEDIUM): every rival drives one of the model cars (small city car, tuned patrol car, Dante's
  chrome supercar), so far from you each one is a light version of 2 or 3 draw calls. In a pack only the
  **nearest** computer car shows its detailed model (about 27 draw calls: doors, glass, wheels with brakes);
  four on HIGH. Measured by the test robot at MEDIUM: the grid of the final race **217** draw calls, the race
  159 to 186; the night market 193 on the grid, 166 to 205 in the race (before this, a pack of six cost up to 292).
- Every race was driven from the grid by the test robot: the race cars join the raised highway 9 m before the
  barriers that close its ramp in the city, and no race goes down the street of the maglev line (its pillars
  stand in the middle of the road).

## The look and the people in the street (version 8.1)

- **People walk around things.** The people on the sidewalks used to walk straight through street trees, poles,
  benches, parked cars and the corners of walls where a sidewalk is narrow. Now each one steps sideways around
  them (only sideways, so the path bends in a smooth curve) - `src/ai/pedestrians.js`.
- **Cars no longer drive through each other when they turn.** A traffic car stops behind any car in its way:
  cross traffic in a crossing, a car that just turned in front of it, the end of a queue on the road it turns
  into. Two cars in each other's way: the one with the lower number goes first (after 6 s of waiting it moves
  on anyway, so nothing waits forever). At a crossing without lights a turning car waits for a gap, and a car in
  a turn looks out for people on the crosswalk - `src/ai/traffic.js`. Measured by the test robot in six places,
  three minutes: people in poles and walls 20 times before, 0 after; cars in cars 9 times before, 3 after (two
  fast cars meeting in a crossing on a late yellow light); no car got stuck.
- **Story things can be solid.** A maker in `src/story/propsRace.js` can say where its thing is solid
  (`userData.solid`: circles or a line of circles); the story puts them into the city's collision grid and
  takes them out again. The guardrail of the last turn, the food stalls, the posts of the signs and the arch and
  the barriers of the jump ramp now stop cars and people (before, a car that ran wide went through the rail).
- **Trees and plants.** A new leaf picture: twigs with sprays of small broad leaves, gaps where the light comes
  through, calm natural greens (not the bright yellow-green of a cartoon). Tree crowns are made of ten smaller
  cards per puff instead of six big ones, bushes of eleven; leaf edges are smoothed (alpha to coverage) so far
  crowns stay full instead of thin and spotty; trunks are drawn as far as their crowns (no crowns floating in the
  air far away). The plants that hang from planters and balconies are thin ivy now (their own picture), some
  strands turned across the others, instead of flat palm leaves that looked like green ribbons.
- **A clearer picture** (Medium and High, `src/world/postfx.js`, `src/city/materials.js`, `src/world/lighting.js`):
  soft **ambient occlusion** where things meet - the ground darkens near the foot of a wall (a top-down picture of
  the walls drawn once, `cityBuilder.js`), the lowest meters of upright walls darken a little; a new grade with
  more contrast and richer (but natural) colors instead of a flat grey film; a little less sky fill by day so the
  sun and the shadows shape things again; sharper roads far away (anisotropy 8 on Medium); crisper shadows near
  the player (44 m range on Medium).
- **Dynamic resolution** (`src/main.js`): a phone that keeps 60 frames per second for a few seconds gets a sharper
  picture, step by step (up to 1.7x on Medium, 1.0x on Low, 2.4x on High); when it gets slow, the picture gets a
  little softer before the frame rate drops (at most 20 % under the normal setting). Address option `dynres=0`
  switches it off. The FPS button shows the resolution in use.
- The name tags over the garage vehicles show only within 11 m (the start is not a screen full of labels).
- The draw calls stay the same (the same views measured before and after: 312 and 312); the denser crowns add
  about 7 % triangles.

## Chapter 5: RASK (version 9.0)

The next night. **Phantoms' minds live in physical servers** (HALO cores), and KVI ships those servers by sea,
through **Rustwater Docks**. The docks belong to **Viktor Rask** (61), an old smuggler. To get a look at the
cargo, Nate has to work for him. Serious, grey, wet, dockside: short plain lines, feelings through objects (a
child's wristwatch that stopped, a name on a box, a drawing of a ship, a bank record in the dark).

### The missions, and how to start each one

Start any of them from the title screen (**MISSIONS**) or with the address option.

| # | Mission | What happens | Address option |
|---|---|---|---|
| 5.0 | **MEETING VIKTOR RASK** | Mace's garage: Lena points at a map of the docks. "KVI moves the servers by sea. Rask moves everything by sea. If you want the route, you work for him." (If Nate raced Dante or took Theo's jacket: "The Chrome Wolves trust you now.") Mace looks away when she says the name. Drive to the docks, up the steel stairs. Rask sits behind his desk, his back to the window over the yards; a child's wristwatch lies face up on the desk. He does not offer a seat: "I do not ask who sends you. I ask what you can carry." **Choice.** Then the test: carry **one crate** to a grey van past a Guard on foot with a torch (heavy: you walk slowly and cannot run; **SET DOWN** / **PICK UP**). | `?story=chapter05.0` |
| 5.1 | **THE LATE SHIPMENT** | Rask's boat was stopped at sea and its crate went over the side. Take Rask's launch from the pier, **tail the Guard cutter** (not too close, not too far), pick up the **floating crate** when its little light blinks, then **2 Guard boats** chase you (2 stars): **RAM** bumps a boat off its line, **TURN** spins you round, planks on **floating junk** are jumps. Escape into **Rask's channel** to the slip. | `?story=chapter05.1` |
| 5.2 | **CONTAINER 77** | The watched yard B at night: guards on foot with torches, two **floodlights** sweeping from their masts, a drone, the **gantry crane** that lowers its container into the cross aisles (a moving wall: wait for the gap). In through a cut in the fence, **hack the gate box** (the mini-game of Chapter 3), get into the **truck** (the armored van made 18 % bigger) with **container 77** on its **trailer**, out through the gate, into Rask's back warehouse. The **CARGO** bar: every hard hit, and the trailer scraping walls and stacks, breaks a little; at 0 the mission fails. Seen? Then it becomes a chase: lose the Guard before you drive to Rask's door. | `?story=chapter05.2` |
| 5.3 | **WHAT IS INSIDE** | Quiet, no music at all. The container is opened in the back warehouse: rows of **HALO cores**, cold blue light. One crate has a paper label: **M. RASK**. Nate stops. Rask has come in without a sound; he puts his hand on the crate and looks at the **stopped watch on his wrist**. A long silence. Then, quietly: "Whoever brings Mila back, the Docks are theirs." | `?story=chapter05.3` |
| 5.4 | **TRUST** | Dawn, gulls. Rask gives Nate a **sealed package** for the tea stall at the market. Halfway, under a lamp: **Choice** - open it (a child's drawing of a ship: a red ship, two people on its deck, MILA) or leave it sealed. The old woman at the stall puts it in a tin with the others: "One every week. I keep them for him." | `?story=chapter05.4` |
| 5.5 | **THE END OF ACT ONE** | Mace's garage at night, without its lamp. Lena waits in the dark with a bank record on her screen: the day after the crash, KVI paid **200,000 credits to Marcus Doyle**. Nate reads it twice. "I didn't want to tell you in front of him." He turns and looks at Mace, asleep in his chair by the open door, the radio on. **Choice:** wake him now, or wait. A long fade on the rain. **END OF ACT ONE.** | `?story=chapter05.5` |

### Chapter 5 choices and flags

| Flag | Set when |
|---|---|
| `rask_stance` | `'honest'` ("I don't work for crooks") or `'paid'` ("I work for anyone who can pay") in 5.0. Rask's lines, Ivo's lines and the crews follow it |
| `rask_mila_seen` | Nate saw the HALO core labelled M. RASK (5.3) |
| `opened_package` | Nate opened Rask's sealed package (5.4). The woman at the tea stall and Rask notice |
| `mace_payment_seen` | Nate saw KVI's payment to Mace (5.5) |
| `confront_mace` | `true`: wake him now (Chapter 6 opens tense), `false`: wait for the right moment (it opens quietly) |
| `container_taken`, `gate_hacked` | container 77 reached Rask's warehouse; the gate was opened with the hack (not by the alarm) |

It reads Chapter 4's `dante_response` and `jacket_taken` (Lena's line about the Chrome Wolves; Nate wears the jacket).

### RUSTWATER DOCKS (`src/city/docks.js`, its plan is `docks` in `src/city/layout.js`)

East of Neon Mile along the coast, past the highway (x -900 .. -499): **Dock Road** with a gate booth, **two
container yards** (stacks of rusted red, blue, grey ... containers two to four high, aisles and cross aisles for
chases; yard B fenced, with barbed wire and a cut in the fence by the channel), **four ship-to-shore cranes** on
the quay, **two gantry cranes** that drive along their yards and lower a container into the cross aisles (a
moving obstacle with its own collision), **two cargo ships** at the quay (they bob gently), the **channel** from
the sea with a **slip** for boats at its end, a **fishing pier**, **rail tracks** with wagons, **two warehouses**
with roller doors, loading docks and steel walkways, the **covered smuggler market**, the **fuel depot**, and
**Rask's building** (the back warehouse below - hollow, the truck drives in - and his office above it, with a
desk, a lamp, shelves, a map, and a window over the yards). Floodlight masts, puddles, oil, tire marks, pallets,
drums, forklifts. Small future touches: autonomous carriers on the quay, drone loaders over the ships, green
tracking tags on containers. **22 dock workers** in orange vests and hard hats (a few in rain gear) stand at their
work or walk their rounds; the story can send them home.

- Containers: two instanced shapes (detailed near the player, plain boxes far away), one draw call each, their
  colors per copy; the corrugated ribs and the rust come from the metal shader. Everything that does not move is
  merged into the city's shared meshes.
- The sea in the harbor is deep water at a quay wall (no shallows, no surf, a thin line of foam); the channel has
  its own water sheet. The minimap and the big map draw the yards, the road, the channel, the sheds and the ships;
  the GPS follows Neon Mile on into Dock Road.

### Cargo and the truck (`src/vehicles/cargo.js`)

`{ do: 'cargo', vehicle, kind: 'crate' | 'trailer', label, heavy, fragile }`. A **crate** sits on the back of the
roof; a **trailer** is hitched behind and follows the truck like a real one (it cuts corners and stops at walls on
its own). **Heavy** (0..1) makes the engine pull less and the brakes need longer (`v.heavy` in `physics.js`).
**Integrity** drops with hard hits (more than about 2.4 m/s into something) and while the trailer scrapes; it is the
thin **CARGO** bar under the speed (green, amber, red). `spawn` takes `scale` (a bigger copy of any vehicle: body,
wheels, lights and collision grow together).

### On foot with a crate

`{ do: 'carryTo', prop, at, radius }`: **PICK UP** next to the crate, carry it (slower, no running), **SET DOWN**
anywhere (it lies there and can be picked up again), **PUT IT DOWN** at the place.

### Hands that really hold things (`carryPose` in `src/characters/proceduralAnim.js`)

A box held with both hands - the parcels of Chapter 1, the crate and the package of Chapter 5, Rask and the woman at
the tea stall with the package - sits where the arms can hold it (in front of the belly, it rides up and down with the
hips while walking), and the arm solver puts a palm flat on each side of it, the fingers forward. Before, the arms
had a fixed pose and the box a fixed place: it floated under the hands or went through them. Dr. Solberg's case
(Chapter 1) now hangs below her hand, its handle in her closed fingers (`grip`), instead of her fingers going into it.

### The boat in Chapter 5 (`stepBoat` in `src/vehicles/physics.js`)

- **RAM** (button, or B): a hard push forward for 0.6 s (then 3 s to recharge). A Guard boat it touches is thrown off
  its line and loses its motor for a moment.
- **TURN** (button, or V): half a circle on the spot in 0.75 s; most of the speed is lost.
- **Floating junk** (`debrisRamp` prop): up its plank at speed and the boat jumps, lands with a splash.
- The boat may go into Rask's channel; you get out at the **slip** or at the **pier** ("STEER THE BOAT TO THE SLIP OR
  THE PIER TO GET OUT" anywhere else in the harbor). The Guard's boats now come to the harbor and the channel too
  (`water` of docks.js: free places on the water, the way in and out of the channel).

### Guards on foot and floodlights (`src/ai/wanted.js`)

`sentries` take `kind: 'guard'` (a crowd character in rain gear with a torch walks the path; the story gives his
figure with `actor`) and `kind: 'flood'` (a floodlight on a mast that sweeps slowly). Both fill the stealth meter
like the drones of Chapter 3; the stacks block their view.

### Sound (made in code, `src/audio/music.js`)

In the docks: rain on corrugated metal and on containers, drops plinking on steel, the low idle of ships and trucks,
a crane groaning when one moves near you (and the clank of its spreader), a ship's horn far out at sea, a forklift
backing up, a chain rattling, **gulls in the morning**. The tense pad only plays in the heist and the chases; the
reveal is in total silence. Rask speaks over the radio in some missions (the subtitle says RADIO).

### Mobile UX

Truck: the normal driving buttons (gas, brake, handbrake, horn); the CARGO bar under the speed. Boat: QUIET, **RAM**
(where NITRO sits on a car) and **TURN** (where LIGHT sits). On foot: the big action button shows PICK UP / SET DOWN /
PUT IT DOWN / GIVE. Objective text and subtitles stay where they were (thumb-safe).

### Performance (measured in the test robot's software renderer at MEDIUM)

From the player's camera the docks take 80 - 160 draw calls (Dock Road 158, yard B 138, yard A 125, the market
124, the quay 92, the office 78; the city itself is 100 - 170) and 0.7 - 0.8 million triangles. The plain far boxes
of the containers cut a wide view over the yards from about 2.4 to 1.4 million triangles. At most 22 dock workers
are drawn near the port (one draw call, 11 on LOW, where the carriers and drone loaders also stand still); the
city's own walkers do not come into the docks.

### What was built for it

`src/city/docks.js` (the district, the moving cranes, the crews, the harbor water for the Guard), `docks` in
`src/city/layout.js` (the plan, the ground, the channel, the pier), a chain-link fence picture and material, the
harbor water mode of the sea shader, `src/vehicles/cargo.js`, `rescale` of a vehicle, RAM / TURN / ramps in the boat
physics, guards and floodlights in `wanted.js`, the steps `cargo`, `carryTo`, `pickup`, `docks` in the story engine,
`src/story/propsDocks.js` (the watch, the crate, the floating crate, the floating junk, the gate, the HALO racks and
crates, the open container, the package and the drawing, the tin, the bank laptop, the map, the torch, the armchair),
the docks ambience in `src/audio/music.js`, and `src/story/chapters/chapter05.js` (only data).

## Realism pass: natural shapes, a real camera, clean characters (version 9.1)

Reported from play: "it looks like cubes in places", "everybody looks short in the camera", "white dots on the
characters", "make the watch premium", "the characters need detail". What changed:

### The camera (`src/player/camera.js`, `camera` in `src/config.js`)

The walking camera was above the head and looked down, so the legs looked short and the head big (everybody looked
short and squat). Now it works like the big open-world games: the camera is about as high as the eyes (pivot at
the chest, 1.32 m; distance 3.5 m; a little look-down), the player is bigger in the picture and keeps his real
proportions, the horizon runs through his head. The view is 50 degrees high and never wider than 82 degrees (people
at the edges of a wide phone are no longer stretched). When you walk without touching the camera, it comes back to
this height by itself after about 2 seconds. With a wall right behind the player it rises over his shoulder
instead of sitting in the back of his head.

### No more white dots on the player (`src/player/player.js`, `src/main.js`)

The white dots came from the old way of hiding the player when the camera was pressed against him: a pattern of
holes ("alpha hash") through which the bright street showed. Now the player is a normal solid model; only when the
camera is really at his head (less than about 60 cm) does he turn see-through - a soft even fade, no dots. The
see-through version of his shaders is prepared at the start, so it does not stutter the first time.

### People in the crowds (`makeHumanFigure` in `src/city/models.js`)

The walkers on the sidewalks, the dock workers and the race spectators were boxes (box legs, box arms, a six-sided
body). Now every one of them is a smooth person: a shaped body (hips, waist, chest, shoulders), tapered arms and
legs, round knees and elbows, hands, rounded shoes, a head with a nose, ears and hair (workers: a vest with
reflective stripes, gloves, a hard hat; spectators: a long coat). Walking, the knee now bends (the shin swings back
while the leg comes forward). Still one draw call for all of them; about 1270 triangles a person (spectators 680),
and only the people who are out are drawn (before: always 80).

### The watch (`stopWatch` in `src/story/propsDocks.js`)

Rask's stopped watch is a real watch now: a turned steel case with a polished bezel and a crown, a domed glass, an
enamel dial (minute track, colored numbers, a little sailing boat), real hands stopped at 4:12 (and the second hand
at 38), a red leather strap with white stitching, holes and a steel buckle. On the desk the strap lies open; on his
wrist it goes round the wrist with the dial on top.

### The ships (`src/city/ship.js`)

The two cargo ships were boxes with a pointed end. Now the hull is one curved surface made like a real lines plan:
round bilges, a full middle body, a raked bow that flares out above the water, a bulbous bow under it, a rounded
stern with a transom, a deck that rises toward the bow; antifouling red under the water, a black boot top, the hull
color above, the name on both bows and on the stern. On deck: the accommodation house in tiers with rounded corners
and window bands, the bridge with its wings over both sides, a mast with radar scanners, a raked funnel with a
colored band and a black top, an orange free-fall lifeboat on its ramp, hatch covers, railings, bollards, anchors,
a light mast on the forecastle. The containers on deck are the docks' detailed containers.

### The docks' machines and the market (`src/city/dockModels.js`, `src/city/docks.js`)

- Forklifts: a rounded body with a curved counterweight, wheels with rims, the overhead guard on slanted posts, a
  seat and steering wheel, the mast with chains, the carriage and two forks, an amber beacon.
- The autonomous straddle carriers (tapered legs on rubber wheels, lidar domes) and the drone loaders (a rounded
  body, ducted rotors, a crate on straps).
- The market stalls: tables on legs with a shelf of crates; on top real goods (fruit in crates, full sacks, woven
  baskets, piles of folded cloth, bottles and jars, a box of old electronics with a glowing screen); a cloth roof
  that sags between four poles, the bulb on its wire.
- Rounded edges on the gate booth, the crane cabins and machine houses, the spreaders; the crane stays, the spreader
  cables and the mooring lines are round cables; the crane bogies stand on wheels.

### Cost (measured the same way before and after, MEDIUM, phone screen 915 x 412)

Draw calls did not change (a ship view 191 -> 186, the market 260 -> 261, a street 221 -> 221 - these counts include
the shadow maps). The main picture has more triangles: a ship view 0.74 -> 0.89 million, the market 0.81 -> 1.02
million, a street 1.07 -> 1.20 million (the smooth people, the ships, the market). This still has to be checked on
a real phone; if it is too slow, LOW quality halves the crowd.

### Honest limits of this pass

- The main characters (Nate, Lena, Rask, Mace ...) are the model files that were given: AI-made scans of about
  26 000 triangles with one 1024 x 1024 picture for the whole body. Their detail cannot be raised by code - a sharper
  face needs a better model file (more triangles, a 2048 or 4096 picture). The faces were already cleaned and lit
  (`faceClean.js`, `characterLook.js`).
- The buildings of the city, the cars and the other districts were not rebuilt in this pass; the docks, the crowds,
  the camera and the watch were.

## Motion pass: smooth film scenes, real car crashes, walking styles, speaking mouths (version 9.2)

Reported from play: "the story scenes glitch when the camera moves while people talk or walk", "cars drive
through cars", "make the characters speak well, the mouth properly", "fix the walking style - like in these clips
(GTA V walk styles, a soldier, GTA VI and RDR2 walks) - and give everybody one".

### Film scenes without stutter (`src/vehicles/vehicle.js`, `src/story/actors.js`, `src/main.js`)

Four things made a film scene jerk while the camera moved:
- People more than 55 m from the PLAYER were moved only 2.5 times a second (to save time) - but in a film the
  camera is often far from the player, right next to them. Now it counts the distance to the camera too: people
  near the camera move every frame (measured: a talking head moved in 2 of 60 frames before, 58 of 60 now).
- The cars moved in steps of 1/60 s while the screen can draw 50, 90 or 120 pictures a second, so a car (and the
  camera that follows it) jumped 0, 1 or 2 steps per picture. Now every vehicle is drawn between its last two
  physics steps (measured at 120 pictures a second: the uneven movement of a driving car went from 0.17 m to
  0.003 m, and 20 "frozen" pictures in a row to none). The film camera, the cargo trailer and the story's places
  "on a car" use the same smooth position.
- The sharpness and the graphics level adjust themselves to the frame rate - in the middle of a film that was a
  visible jolt. Now they never change during a film scene (and wait 8 s after a change).
- In a film the detail of the city (props, people) is now kept around the camera, not around the player.

### Cars no longer drive through cars

Before, only the player's car stopped at the traffic. A police car, a story car, a parked car you left behind:
the player's car drove right through them (measured: 1.7 m deep inside), a Guard car could sit inside the player's
car, and the traffic drove through all of them and through each other at crossings. Now:
- REAL CAR AGAINST REAL CAR (`hitCars` in `src/vehicles/vehicle.js`): both cars are pushed apart and both feel
  the hit by their weight - momentum is shared, crumpled metal gives little of the speed back (a light car moves
  more, the armored van hardly at all), a hit at a corner turns the car, hard hits damage both, sparks and bits
  fly, and you hear a crash between two other cars nearby. A parked car that is hit rolls and stops by itself.
  Rammed by the police: the screen shakes and the car is damaged - but the police counts as YOUR crime only when
  you drove into them (before, a police car bumping into traffic gave the player stars).
- THE TRAFFIC (`hitTraffic`, `src/ai/traffic.js`): its cars run on their lanes, so a hit pushes them along the
  lane (hit from behind, it is shoved forward) and slides them a little to the side; the driver stops, honks and
  steers back. The traffic now sees every real vehicle (police, story, race, parked) and brakes for it or follows
  it; and as a last check a traffic car never moves its nose into another car (traffic, real car, the player on
  foot) - no more cars through cars at crossings.
- Scripted cars: a car the story moves exactly (Zero arriving, Dante's car) is not pushed, but slows down behind
  a car in its way (after 3 s it drives on - the story must go on) and the traffic in front makes way for it.
  Zero's strike in the final race and the prologue's crash still happen exactly as written.
- Computer drivers adapted (`src/ai/roadSense.js`): the Guard cars and the pursuers of the story used to drive
  down the MIDDLE of the street (the GPS line) - right through the traffic on both sides. Now they keep to their
  lane and slow down behind a car in front; with the siren on, the traffic pulls over further (2.4 m, toward the
  curb, from 80 m away) so they pass without touching. Closing in on a stopped player a Guard car brakes in time
  and stops with the bumpers nearly touching (BUSTED still works), it rams only while you flee. Story cars on a
  path brake for the player in front (4 s at most, the story must go on); a racer of the story moves over to let
  a faster player pass and goes round a slower one. (Measured, chase at night with traffic: the first Guard car
  is within 40 m after 8-12 s - before 10-14 s - and stops 5-6 m from the stopped player; before, it drove
  through the player's car.)
- A car standing still in their way - a parked car, a car left on the road, the player's stopped car while the
  Guard only searches: a real driver goes round it, and so do they (`goRound` in `roadSense.js`). They stop a few
  meters behind it (room to swing out), wait 3 s if it is a traffic car in a queue, then drive round it on a
  smooth curve on the other side of the street and back into their lane - cars standing in a row are passed in one
  go - but only when that way is free: no pillar, wall or tree on it, no car on it or coming along it. Else they
  try the other side, or wait and look again. On the street under the raised rail line they keep 20 cm further
  from the pillars in the middle (they used to scrape them) and still fit past a car pulled over for the siren.
  Measured (`goround_test.mjs`), a Guard car coming at 43 km/h toward a car parked in its lane: in the old version
  it drove through it; with solid cars but without this it stood behind it for good; now it is past after 5 s,
  1.3 m from the parked car, and back in its lane. Two cars in a row: past both (1.3 and 1.4 m from them). Behind a
  standing traffic car it waits 3 s and goes round (1.1 m from it); on the pillar street, where the way round is
  blocked, it waits and touches nothing.

Measured with a crash test (`crash_test.mjs`, the same test on the old and the new version):

| | before | after |
|---|---|---|
| player's car into a parked car at 30 km/h | drives 1.74 m deep into it, through it | stops at it, the parked car is shoved 1.1 m, both damaged a little |
| a Guard car chasing the stopped player | sits 1.70 m inside the player's car | stops 7.4 m away (busted range), touches nothing |
| a car rams the stopped player at 60 km/h | drives 1.74 m into it | the player's car is pushed 13.9 m and damaged |
| 2 minutes of traffic around the player | 2 pairs of traffic cars and 4 traffic/real pairs overlapped | none |

### Walking styles (`WALK_STYLES` in `src/characters/proceduralAnim.js`)

Every walk is still made by code from the step cycle (no animation files), but now with a STYLE: about 20 numbers
for the step length and width, the feet turned out, the hips (turn, drop, sway), the bounce, the lean, chest out
or a round back, the chin, the shoulders (turning against the hips, rocking, pulled up), how far the arms swing
and how far from the body, the elbows, the hands (open, fists) - studied from the clips: normal, femme, gangster
("swagger"), posh, tough guy, a soldier in gear, and the natural walks of the newest games. Ten styles: normal,
confident, femme, brisk, swagger, posh, elegant, tough, soldier, old. They also change how a person STANDS.
- Who walks how: Nate confident (you can change it: SETTINGS - WALK STYLE, a button that goes through all of
  them, like the interaction menu of the big games), Lena brisk, Rask old (stooped, short heavy steps), Mace tough
  (arms out, fists), Dante swagger, Juno soldier, Dr. Solberg elegant, Captain Harrow posh, Theo confident. Other
  people of the story get a style from their name. The story can set one (`gait: 'posh'`).
- The crowds (the walkers and the dock workers): everybody gets a style in the crowd shader too - how far the arms
  swing, the step, the hips moving over the standing foot, the shoulders turning against the hips, the lean,
  arms held out, the bounce; old people walk slower and lean forward. Still one draw call.
- A fix found on the way: on a slow phone (under 20 pictures a second) the body moved on while the steps lagged
  behind, so the strides grew far too long. The animation now keeps up with frames up to 1/10 s.
- Measured: a planted foot does not slide (0.000 m per frame in every style).

### Speaking (`src/characters/speech.js`, `src/characters/faceAnim.js`)

Before, a speaking mouth opened and closed in random syllables. Now the mouth says THE WORDS of the line: the text
is turned into the mouth shapes of its sounds (14 shapes: "a" open, "ee" wide, "oo" small and round, m/b/p lips
pressed together, f/v, s, th, t/d/n/l, ch/sh, r, k/g), each with its own length, the shapes flowing into each
other (the lips move ahead of the sound), commas and full stops as pauses with the mouth closed, the whole line
fitted to the time its subtitle stays. With the words:
- the eyebrows lift a little on stressed words (the first word of a sentence, long words, words before "!"), more
  at the end of a question, and the eyes blink at the end of a sentence;
- the head nods a little on the stressed words and tilts at a question - also sitting and driving; while
  speaking a person looks ahead at the one they talk to instead of letting the eyes wander;
- the hand that moves while speaking now beats with the stressed words instead of waving at random;
- a THOUGHT (Nate's inner voice) no longer moves his mouth.

### Honest limits of this pass

- Tested by a robot in a software renderer, frame by frame - not watched on a real phone, so the feel of the
  crashes and the walks still needs your eyes.
- Traffic cars still drive on lanes: hit hard they are shoved along the lane and a little to the side, but they
  do not spin away like the real (physics) cars. The parked cars of the city are solid and do not move.
- The mouth follows English spelling with simple rules (no dictionary): most words look right, a few odd
  spellings get a slightly wrong shape. The models have one jaw and two mouth corners, no separate lips or
  tongue, so "f" and "th" are only approximated.
- The crowd's shadows still show the walkers standing (their shadow is not animated).
- The Guard cars drive by the streets. When you stop off the road (a yard, a square behind a corner), the last
  meters to you are straight across, and a Guard car can get caught at a corner there, back up and try again.

## Character quality: sharp faces, real eyes and lips (version 9.3)

Reported from play: "the characters look very blurry and not good - any character; make the quality so high that
you could see the hair on the arms", and after a first try: "in places you messed up the mouths; I asked for
quality so good that hair would show, not for added hair; in places the eyes and the lips are not right - it has to
look real". So nothing is painted onto the people (the first try added fine arm hair and skin bumps - removed);
their own pictures are shown as clearly as possible, and the eyes and the mouths were fixed.

### Why they looked blurry (measured)

- Every character model carries ONE picture for the whole body: 1024 x 1024 points, strongly compressed, in many
  small pieces. A face gets about 150 x 150 points of it, a hand about 50.
- On a phone the 3D picture is drawn smaller than the screen and then stretched (LOW: 0.75 of the screen's
  points, MEDIUM: 1.0 - 1.3), which softens it once more.
- The pictures were read without anisotropic filtering: blurry at a slant (arms, the sides of the body, a face
  turned away).
- The empty space between the pieces of the picture was dark: the GPU blends neighboring points, so the dark
  bled into the edges - thin lines along the seams.

### What changed

- SHARPER PICTURE (`src/characters/characterDetail.js`, once, when a character is loaded): the character's picture
  is sharpened - an unsharp mask on the brightness only (no colored fringes), only inside the pieces of the picture,
  very small differences left alone (the compression noise does not grow), limited (no halos) and weaker next to
  the edge of a piece (seams do not stand out). The eyes, brows, lips, wrinkles, seams and folds of the clothes
  come out. Anisotropic filtering (8x) on all of its pictures. It is done once per character (when a chapter
  loads its people), in three short steps with a break between them, so the game never stops for long.
- CLEAN SEAMS: the empty space around each piece of the picture is filled with the piece's own edge colors
  (6 points wide), so no dark lines along the seams.
- THE SCREEN PICTURE (`src/world/postfx.js`): MEDIUM and HIGH now sharpen the finished picture (contrast adaptive
  sharpening: strong where the picture is soft, weak where it already has contrast - no bright or dark halos).
  When the phone keeps up (57 pictures a second and more), the sharpness may now rise further than before: LOW up
  to 1.25 points per screen point (was 1.0), MEDIUM up to 2.0 (was 1.7). It still goes down when the phone gets
  slow. No extra draw calls.
- WET EYES (`src/characters/characterLook.js`): the eyes are found from the face (where the eyelid bones are, how
  deep the eye lies in its socket). They shine like a wet surface, and each has a small light in it (the sky's
  reflection), a little above and to the left of the middle, only on the dark of the eye - never on the skin. Now on
  all 11 characters (Sloane, Adrian and Calder have deep-set eyes: the search for the eye's depth looks wider when
  it finds too few points). The light is small and soft, like in a photo, and a little stronger at night when the
  face has its fill light.
- REAL MOUTHS (`src/characters/faceRig.js`): a speaking mouth used to open along the whole line between the lips -
  a crack, and where the painted picture made that line uneven, a zigzag (Theo) or a notch in the corner (Lena).
  Now the mouth opens like real lips: most in the middle, closing smoothly toward the corners (an almond shape).
  The line between the lips follows a smooth curve fitted to the face (a least-squares curve through the painted
  line, it moves it 2 mm at most), so the lips close in a clean line at rest. Checked close up on all 11
  characters, at rest and in three moments of speaking.

Measured on all 11 characters, the same close-up before and after (MEDIUM): the fine detail in the picture of the
face (its edge energy) went up by 74% to 116% - about twice as much - and the contrast of the edges by 47% to 78%,
with no halos.

Cost (MEDIUM, the same test before and after, two runs each, in the test robot's software renderer): the same draw
calls (164), and the drawing time is the same within the measuring noise - the game view with 4 people 1367 ->
1385 ms per picture (+1%), a face close-up 1355 -> 1391 (+3%), an arm close-up 1320 -> 1265 (-4%); the same test
run twice differs by up to 6%. The work on each character's picture is done once, while the character is loaded:
two short pauses of the game of about 60-90 ms each in the test robot (on a phone a few times more), about as
long as the cleaning of the face that was there before; in one piece it was 130-270 ms. (Tried and dropped: doing
it in the background worker - in the test robot the game then paused longer, not shorter.)

### The traffic and the cars left on the road (`src/ai/traffic.js`, `src/main.js`)

Found while testing: the traffic saw the real cars (police, story, a car you left behind) only up to 160 m from the
player, but it drives up to 250 m away - out there it drove through them, and a new traffic car could even be put
down right on top of one. Now the traffic sees them as far as it drives, new traffic cars are never put down on a
real car, and a traffic car that a real car was set down on and stays on (a police car arriving, a car of the
story) - out where nothing pushes the two apart - is taken away. A car moved a little to the side to get past something at the edge
of its lane is no longer held up by it for good. Measured: 10 cars standing on traffic lanes 115-160 m from the
player, three times 2 minutes of traffic: before, a traffic car drove into one of them 30 times; now never (one
traffic car that the test itself had set a parked car down on was taken away after half a second).

### Honest limits of this pass

- The pictures of the models are small: sharpening brings out what is there, it cannot invent detail. Real skin
  pores or the hair on the arms need new models with bigger pictures (for example 4096 x 4096 from the 3D
  generator) - the game would load them the same way.
- Some seams are in the model itself and stay (a light edge at the corner of Lena's mouth).
- The sharpening of the screen picture is on MEDIUM and HIGH; LOW has no screen effects at all (it only gets
  sharper when the phone keeps up).
- Tested by a robot in a software renderer, close up and in the game view - not watched on a real phone.

## Chapter 6: OLD DEBTS (version 10.0)

The next night, and the quietest chapter of the game: **no chase, no gunfight, no timer, no stars, no minimap**. One
room - Mace's garage at night, rain on the roof - and slow film shots: close-ups of hands, wide shots as if through a
rainy window, slow push-ins on faces. Short plain lines; nobody shouts. Nate and Mace rebuild **Theo's car** together,
and while Nate works, Mace tells a short story about Theo. Before the last part, Nate puts the bank record on the bench.

### The missions, and how to start each one

Start any of them from the title screen (**MISSIONS**) or with the address option.

| # | Mission | What happens | Address option |
|---|---|---|---|
| 6.0 | **RAIN ON THE ROOF** | Nate comes down the stairs from his flat into the garage. A warm night (he did not wake Mace in Chapter 5): Mace looks up from the bench, "You're soaked. Kettle's on." - "Thanks." - "The car. I think it is time. I want to fix it. With you." A colder night (he did): Mace stays at the car with his back to the stairs, "Kettle's on.", a long silence, "The car. If you want." - he does not meet Nate's eyes. Then the room is Nate's: walk about, **LOOK / TOUCH / LISTEN** at nine things (the radio - it plays an old waltz, the kettle and two mugs, Theo's photos inside the cabinet door, **T.C.** cut into the bench, the height marks **T and N** on the door frame, the pegboard, Mace's armchair, the rainy window, Theo's first oil stain); each gives one short line from Nate. **HELP MACE** at the car starts the work. | `?story=chapter06.0` |
| 6.1 | **THEO'S CAR** | Five calm stations, five stories (below). Between them the room is Nate's again; **BACK TO WORK** at the car goes on. | `?story=chapter06.1` |
| 6.2 | **THE LAST PART** | The tape deck, where Theo's mixtape goes. Mace's sixth story: Theo wanted to leave the city - and take Nate with him. The deck stops short. Nate puts the **bank record** (Lena printed it) on the bench, beside Theo's initials. No music, steady rain, the radio only hisses. "Two hundred thousand. The day after." - "Yes." KVI came the morning after the crash: it did not have to be an accident; Nate was driving; they could make it murder, prison for years. Mace took their money and the case went away; most of it paid Nate's hospital bill, which Nate never saw. "I would do it again." (a pause) "I would also hate myself again." Nate looks at the cloth on the floor for a long time. **Choice:** *I forgive you.* / *Leave.* / *Stay silent.* (the third only for a player who heard at least three of Mace's stories). One soft pad starts at this scene. | `?story=chapter06.2` |
| 6.3 | **WHAT IS LEFT** | **Forgive:** Mace looks at him for the first time tonight, takes a key from his pocket - "It is yours now." - and they fit the last part together; the tape goes into the dashboard. **Stay silent:** Mace lays the key on the bench and steps back; Nate fits the part alone, takes the key, Mace turns the radio off. Both end on the same image: the car whole under the work lamp, Mace's hand on its roof, the light off; Nate in the driver's seat plays the mixtape - track 7 is silent, and this time he does not skip it. **Leave:** Nate walks out; the car stays unfinished under its lamp; outside in the rain he drives away - his eyes on the wet street, and in the rear-view mirror Mace in the lit door behind him, the light getting smaller - the radio still playing inside, faintly. After the choice a short quiet motif plays once; WREN speaks once, quietly: *"Do you want me to stop listening?"* Three seconds of silence on the last image. | `?story=chapter06.3` |

### The six stations (`src/story/repair.js`)

A soft panel on the right of the screen (one thumb), the film camera on a slow close-up of the part, Mace's story as
subtitles. **No failing, no score, no clock**: letting go never undoes anything, a part dropped in the wrong place floats
back. After the story, a silent beat: Mace stops, wipes his hands on a rag, goes back to work - and the car gets a little
cleaner (its dust goes from 1 to 0.3 over the five stations, to 0.08 when it is whole). Each station can be done
**AGAIN** (the part comes off, the story is told again) or **GO ON**. HOLD TO SKIP puts the part in place at once (that
story then does not count as heard).

| # | Part | Gesture | Mace's story |
|---|---|---|---|
| 1 | the cloth | slide up, slowly | Theo drove his first car in this garage at twelve, stalled it three times by the drain, then laughed so hard he could not breathe |
| 2 | the bent frame | pull the chain down and hold | the garage cat with one bent ear, which Theo secretly taught to sit by the radio - with sardines |
| 3 | the front bumper | drag it into place | Theo hated tools, but when an engine caught he closed his eyes, like somebody was playing him music |
| 4 | the engine | turn the air cleaner to the mark, press it down | two honks outside when he came back late, so Mace knew it was him - "I still listen for it. Every night." |
| 5 | the lights | swipe one plug to the other | a woman broke down out front in the rain; Theo fixed her car for free - "practice" |
| 6 | the dashboard | slide the deck in (it stops short the first time) | Theo was going to leave the city and take Nate with him |

Theo's car is made in code (`src/vehicles/theoCar.js`): a low two-door coupe, scratched blue paint, Theo's **7** in a
white roundel on each door. If **`assets/vehicles/theo_car.glb`** exists it is shown instead (meters, +z the nose, +x
the car's left, the ground at y = 0); parts named `bumper_old`, `bumper_new`, `hood` (origin on the hinge),
`air_cleaner`, `deck`, `lights` follow the repair, and the dust darkens its paint.

### Chapter 6 choices and flags

| Flag | Set when |
|---|---|
| `mace_forgiven` | `true` (I forgive you), `false` (Leave) or `'neutral'` (Stay silent) - also as a word in `c6_end` (`'forgive'`, `'leave'`, `'neutral'`) |
| `wren_muted` | Nate answered WREN's question with Yes: she says nothing until Chapter 8 (engine.js skips her lines) |
| `heard`, `heard_1` .. `heard_6` | how many of Mace's stories were heard to the end (a skipped story does not count); *Stay silent* needs 3 |
| `garage_open`, `theo_car`, `theo_key`, `upgrades_at` | forgive or neutral: the garage stays a safe place, Theo's car is a vehicle of the game, upgrades at `'garage'` |
| `garage_open: false`, `mace_back: 9`, `upgrades_at: 'lena'` | Leave: the garage is shut, Mace does not appear until Chapter 9, upgrades only at Lena's new base |
| `c6_looked` | how many things Nate looked at, touched or listened to |

Uses from Chapter 5: `confront_mace` (true: the colder night). After the chapter, in **free roam**: forgive or neutral -
Theo's car stands in the garage, whole (kind `theo_coupe`: the chrome supercar's physics with Theo's body; its tarp
and the tarp's collision are gone so it can be driven out), and driving slowly into the bay fixes a damaged car;
Leave - the roller door is down and solid. (There is no upgrade shop in the game yet: `upgrades_at` is ready for it.)

### The calm screen and mobile UX

A chapter with `calm: true` (`body.calm` in `index.html`): no minimap, no stars, no mission box, no GPS arrow, no
markers - only the objective as one small soft line ("Mace is by the car."). The action button becomes a big soft
round button (LOOK / TOUCH / LISTEN / HELP MACE / BACK TO WORK), the choices are tall rounded buttons, HOLD TO SKIP is
bigger. Subtitles have a fourth size: **SETTINGS → SUBTITLES → XL**. A question (WREN's) stays on the screen, above the
buttons, until it is answered. No tilt and no fine controls are needed.

### Sound (made in code)

Steady rain drumming on the metal roof, water in the gutter, single drops on steel, thunder far away every 40 - 80 s,
the kettle (its switch clicks on, the water comes to the boil, it clicks off by itself), the radio (an old waltz made
from a few chords and a little tune through a small old speaker, with the hiss of a weak station; it can be switched on
and off), tools (a clink, a ratchet), steel creaking under the chain, cloth sliding, a spark when the wires meet, keys,
paper. One soft pad begins at the confrontation; after the choice a short motif plays once (rising, open or falling,
for forgive, neutral, leave); three seconds of complete silence on the last image.

### Performance (measured in the test robot's software renderer at MEDIUM)

While the chapter runs, the city is not drawn at all (the camera sees only "layer 4", like inside a house), traffic and
people are taken away, and the camera stays inside the bay. The city also sleeps: its props, the train, the cranes and
the canal water are not updated while the garage is the whole picture (they wake up the frame it is gone). The city is
not taken out of memory - building it again would take far longer on a phone than keeping it - but nothing of it costs
time on the screen. In the garage the robot measured **44 to 110** draw calls
(44 looking at the door, 61 at the bench, 58 at the back shelves, 109 looking at Theo's car with both people beside
it, 110 in the first station's close-up) and **171,000 to 217,000** triangles. The limit asked for was 150 draw calls.

### What was built for it

`src/story/garageSet.js` (the garage as a set: lamps, haze, a rainy window, the roller door, the door to the stairs,
the cabinet with the photos, the height marks, the radio, the kettle, the chain puller, the cloth, its own colliders),
`src/vehicles/theoCar.js` (Theo's car, parts that can be repaired, the paint with dust, scratches and the roundel),
`src/story/repair.js` (the six stations), `src/story/rearView.js` (a real rear-view mirror for a film shot: a small
second picture of the world behind the car, mirrored, made only while the shot runs), the steps `garage`, `explore`,
`repair` and `rearView` in the story engine (and choice
options with a condition, number conditions, WREN keeping quiet, hands that go to a place), the poses `work`,
`spanner`, `wipe`, `putDown`, `roof`, `lean`, `give` in `src/characters/proceduralAnim.js`, `src/story/propsGarage.js`
(the bank record on paper, a spanner, Theo's key, a rag), the vehicle kind `theo_coupe`, the calm screen, the garage
sounds in `src/audio/music.js` and `src/audio/sound.js`, and `src/story/chapters/chapter06.js` (only data).

## Body language: the whole body speaks (version 10.1)

Reported from play: "Whenever someone talks, their whole body should move - like in real life." Before, a speaker
moved the mouth, nodded a little on stressed words and lifted one hand. Now the whole body says the line
(`src/characters/gesture.js`, `src/characters/speech.js`, `src/characters/proceduralAnim.js`).

**The words make the plan.** speech.js gives the time of every word and every sentence (the same times the mouth
uses), and gesture.js turns them into a short plan of gestures, each on its word:
- a stressed word: a hand beats (angry: a fist; firm, before a "!": the edge of the hand chops down);
- "you", "your", "we", "us": a palm turned up and held out to the listener (angry: an open hand toward them);
- "I", "me", "my", "myself": a hand laid flat on the chest - on the chest of THIS body (the front of the chest is
  measured from the model, so it lies on a big man's chest and on a thin woman's alike);
- "no", "not", "never", "don't" and the like: a flat hand swept out, palm down, and the head shakes;
- "all", "every", "everything", "whole", "always": both hands apart, palms up;
- "maybe", "if", "guess", and the last word of a question: palms up and the shoulders rise (a shrug), or a palm
  held out, waiting for an answer;
- a stressed "this", "that", "here", "there": an open hand toward it.

**The rest of the body goes with it.** The chest leans in a little and turns toward the hand that moves, the
shoulders rise at a shrug, the head nods on the word, shakes for "no" and tilts at a shrug, and at the start of a
sentence the weight goes from one foot to the other (the hips over the standing leg, that hip a little higher).

**Like a real gesture.** The hand gets ready a little before its word, moves through on the word, overshoots a
touch and settles, holds a moment, then waits low or goes on to the next one; after the line the arms go back to
hanging. An arm always starts from exactly where the hanging arm is, so nothing jumps. The palm turns (up to offer,
down for "no"), the wrist bends back for an open hand, the fingers open, spread or close.

**The mood decides how much.** Tired, sad or in pain: small, slow and few gestures. Neutral: natural. Happy: open.
Angry or shouting: sharp, quick and often. (Chapter 6 stays quiet: Mace is tired and sad there.)

**Busy hands keep their work.** Working on the car, arms crossed, hands on the hips, carrying a box, hands on the
wheel: then only the chest, the shoulders and the head speak. Sitting, the forearms lift from the legs and move,
smaller. Walking, the arms keep swinging and only a little of the gesture comes through.

**Listening.** People within 7 m of a speaker nod a little now and then and shift their weight (not for WREN in
the ear or a voice on the radio).

The same line gets the same gestures from the same person every time (the plan is made from its words), but two
people say it a little differently.

Tested: every gesture held still, from the front and from the side (Mace and Lena); lines in a neutral, an angry
and a sad mood frame by frame; standing, sitting, working, with arms crossed; Nate (the player); and as story
scenes, with no errors: the Chapter 6 confrontation (Mace's hands stay on the bench, only his head and shoulders
speak - the scene stays quiet), the start of Chapter 2 (Nate at the wheel) and the first two missions of Chapter 5.

## Chapter 8: TALK TO ZERO (version 11.0)

The next night, after Chapter 7. Emotional, intimate, eerie: Ironhill Highway at night in the rain, two cars side by
side, a voice from the radio. Short plain lines, long silences. The camera stays on the two cars in the rain.

**Chapter 7 is not written yet.** The story engine steps over a chapter that does not exist: the end of Chapter 6 now
leads to Chapter 8 (and it will lead to Chapter 7 as soon as `src/story/chapters/chapter07.js` is added - nothing else
has to change). Chapter 8 reads the Chapter 7 flags `dante_captured` and `juno_fate` when they are there; without them
Dante's chair and Juno's bike are left out. To see those two moments now, use the address option `flags=` (see
"Address options").

### The missions, and how to start each one

Start any of them from the title screen (**MISSIONS**) or with the address option.

| # | Mission | What happens | Address option |
|---|---|---|---|
| 8.0 | **THE PILOT KEY** | Lena's safehouse, short. Rain on the window; the news plays on the TV with the sound almost off (Vance's face, a LIVE band, a ticker about KVI's night patrols). Lena sits at her work table and sets up the pilot key on her laptop - it glows green. "Zero will answer only if it sees a car at full speed." - "It needs to see you first." If Dante was captured (Chapter 7), Nate looks at Dante's empty chair and nobody says anything. If Juno was spared, Lena: "Juno left her bike downstairs. She said she'll come back for it." | `?story=chapter08.0` (with the two Chapter 7 moments: `?story=chapter08.0&flags=dante_captured,juno_fate:spared`) |
| 8.1 | **BE SEEN** | Ironhill Highway, night, rain (the race road of the prologue, going on north out of the city). Drive over 150 km/h for 30 seconds - the seconds add up, a short slow-down does not reset them. On the way, out of the dark behind: a soft cold glow in the mirror, no siren, no sound but the engines - Zero (the proximity system of Chapter 4). It passes close on the left and leads. Then stay with it for 15 seconds and do not lose it (fall back and the objective says "catch up with its glow"; Zero waits a little). | `?story=chapter08.1` |
| 8.2 | **SIDE BY SIDE** | Zero slows and comes up beside Nate's car: its glow on his door, his headlights and the rain lit by it. Hold the two cars side by side - level, one lane apart, the same speed - for 20 seconds of steady driving while Lena links the pilot key: the hack game in a gentle form (long nodes, no clock, no penalty, a big STEADY hint). Only wind, tyres and the two engines. | `?story=chapter08.2` |
| 8.3 | **TALK** | The radio connects (close-ups of the dial and the green key). WREN's locked part opens: for two sentences her voice is more like Theo's - "I kept the part of him that remembers being a person." - then she is plain and calm again. A five-second memory without words: Solberg's hidden file, a tiny memory card glowing in a small case. Then the voice: **THEO**, late and broken like a bad signal, with a soft digital hiss. The mixtape first: "Track seven is empty." - "I never recorded it. I was going to, that night." Four seconds of silence. He calls Nate "driver"; the camera stays on Nate's face and on the dark car; then "...Nate." again, and Nate breathes out. The half truth: "I was running that night. They had found me. I was not racing. I was running." **Two replies** (*Why didn't you tell me? / Were you scared? / I am sorry / Say nothing*; saying nothing is always there, it is chosen when no button is pressed in 10 seconds, and it makes Theo's next line come later). **The question:** ask "Did I do it? Did my speed kill you?" - a long pause - "No. You drove the way I taught you. The road did what roads do." - or keep it to yourself. "They found me in the tunnel..." - the signal breaks into static, and behind them come the Phantoms of KVI: police cars with flashing lights, drones over the road, three stars. **Leave the dead radio on, or switch it off.** The story drives both cars in this mission. | `?story=chapter08.3` |
| 8.4 | **RUN** | Escape the Phantoms (three stars) through the Ironhill tunnel. Three Phantom cars in all, at most two at once. Zero rides between Nate and them; inside the tunnel it drops back and takes one out with a silent move - the Phantom spins into the barrier, a moment of slow motion. With the radio left on, pieces of Theo's voice come through the static. Out of the far end of the tunnel the Phantoms give up. (Slow right down with a Phantom on you and they box you in: the mission starts again from its checkpoint.) | `?story=chapter08.4` |
| 8.5 | **DRIVER** | Nate pulls over by the wall just out of the tunnel, in the rain, breathing hard. Zero's glow turns away, back into the orange of the tunnel; the radio is dead and the key's light fades. He puts the mixtape in the dash and does not press play. To nobody: "Driver." Then he laughs once, sadly - it was Theo's joke. One more line: "Okay. Okay, brother." (his last reply was *I am sorry* or silence) or "You still owe me a track." (it was *Why* or *Were you scared*). A slow fade; the engine ticks as it cools. | `?story=chapter08.5` (the other last line: `?story=chapter08.5&flags=theo_reply_b:why`) |

### Chapter 8 choices and flags

| Flag | Set when |
|---|---|
| `pilot_key_ready` | `true`, at the end of 8.0 |
| `wren_fragment_unlocked` | `true`, after the memory of Solberg's file (WREN's locked part is open) |
| `theo_running_confirmed` | `true`, when Theo says he was running, not racing |
| `theo_reply_a`, `theo_reply_b` | the two replies: `'why'`, `'scared'`, `'sorry'` or `'silence'` |
| `asked_crash_question` | `true` (he asked) or `false` (he kept it to himself) |
| `radio_off` | `true` (switched off when the Phantoms came) or `false` (left on) |
| `nate_partial_peace` | `true` when `theo_reply_b` was *I am sorry* or silence, `false` when it was *Why* or *Were you scared* - both reach the same ending, only Nate's last line differs |

Uses from earlier chapters: `dante_captured` and `juno_fate` (Chapter 7 - see above), `theo_car` (Chapter 6: after
*forgive* or *stay silent* Nate drives **Theo's car**; after *leave* he drives Mace's old street car, a bronze sedan),
`wren_muted` (Chapter 6: WREN kept quiet "until Chapter 8" - she speaks again from here).

### The Ironhill tunnel and the road north (`src/city/tunnel.js`, `highway` in `src/city/layout.js`)

The raised highway now goes on north out of the city, over the dark plain, through the **Ironhill tunnel** (320 m,
from z 1000 to 1320) to a closed end at z 1480 (concrete barriers with red stripes, a chevron board). The tunnel has
concrete walls with a pale band, ribs every 8 m, two rows of orange lamps, jet fans, green guide lights, EXIT signs, SOS
boxes and lane signals over each mouth. Its light costs no lamps: the orange light pools are worked out in the shared
city shader, so the tunnel adds no lights and no extra draw calls. Inside there is no rain, the road is dry, the air is
a warm haze; people and cars in it get an orange fill light. The older chapters drive the highway as before (their end
at z 760 is kept; the prologue's grid is south of the tunnel).

### The night run (`src/story/nightRun.js`)

One system runs the road in Chapter 8: **Zero** as a companion (it appears from the dark, follows, leads, rides side by
side, keeps between Nate and the police, blocks one of them, turns away), **the Phantoms** (police cars with flashing
lights: a number in all, at most two at once; they hunt, press and give up), **drones** over the road, the **meters**
(seconds over 150 km/h, seconds with Zero in reach, how steady the two cars are side by side), and the story driving
Nate's car in film scenes. The road north is about 1.5 km and the talk is long, so at a cut between two shots
everything of the run - both cars, the Phantoms, the drones, the camera - is moved back along the road together: the
picture is the same dark rainy road, and a scene never runs out of highway. While you drive, the same happens near the
road's end with a short dip to black. Zero's glow is soft and calm (a cold blue halo and a pool of light on the road
that slowly breathes, the rain lit around it), never a flashing light; its headlights on the road are dimmed, and off
while it rides close behind you.

### The gentle link (`steady` in `src/story/hack.js`)

The hack game of Chapter 3 in a gentle form: six long nodes, no clock, no penalty, nothing to tap. One big word tells
you what to do: **STEADY** (the link grows) or **STAY BESIDE ZERO** (it waits). It only grows while the two cars are
side by side.

### The radio (`src/ui/storyUI.js`, `index.html`)

Theo's lines are **signal** subtitles: a small radio dot and the speaker name THEO in warm amber, which stands out
against the cold blue rain, and words that arrive a little late and broken - some come in as static (`░▒·`) and then
settle. WREN's two sentences in Theo's voice are in italics, her name in pale gold. The replies are four big round
buttons near the top of the screen, away from the steering buttons, with a slow bar for the time left (silence is the
last button, in italics); the subtitles stay at the bottom, clear of the buttons. Close-ups: the
pilot key glowing green on the console (a faint green light in the car), the radio's dial (its needle and its small
light go with the signal), the mixtape in the dash.

### Sound (made in code)

Rain on the windscreen, the two engines in step, wind and tyres; the radio hiss and Theo's voice with a soft digital
delay (made in code, without words - the words are in the subtitles); in the big scene only the rain and the voice
and one low slow pad, which fades out at the silence; static when the signal breaks; a tense pulse for the Phantom
chase, sirens, drones; at the end silence, the faint tick of the engine cooling, his breath and one laugh. In the
safehouse: rain on the glass, the TV very low.

### Mobile UX

Big radio reply buttons, placed away from the steering controls; the link is one big word, nothing to aim at; HOLD TO
SKIP in every film scene; subtitles with the speaker's name in a colour that is easy to read in rain (the size can be
raised up to XL in SETTINGS → SUBTITLES). In 8.1, 8.2 and 8.4 you only drive.

### Performance (measured in the test robot's software renderer at MEDIUM)

Only the highway and the tunnel are active: traffic is limited to 8 cars, people to 0, at most two Phantoms at once and
two drones. The safehouse is a set of its own (the city is not drawn while it is shown). The long film scenes stay on
the dark stretch north of the city (z 540 to 1385), where few buildings are in view. Measured draw calls:
PERF_TABLE
The limit asked for was 250.

### What was built for it

`src/city/tunnel.js` (the tunnel and the road's end), the tunnel light in `src/city/materials.js` (orange light pools in
the shared shader), the dry road and the haze inside (`src/main.js`, `src/world/lighting.js`), `src/story/nightRun.js`
(Zero, the Phantoms, drones, meters, the story driving his car, moving the run back along the road),
`src/story/safehouseSet.js` (Lena's room: the work table, the laptop, the sofa, the TV, Dante's chair, a rainy window, a
small corner for the memory), `src/story/propsNight.js` (the pilot key, the radio dial, the memory card in its case, the
TV with the news), the steps `safehouse`, `run`, `runGoal` and `memory` in the story engine (and a radio layout for
choices, a car's `speed` at a cut, the arena `ironhill`, the `flags=` address option, a story that steps over a chapter
that is not written), the steady link in `src/story/hack.js`, the signal and WREN subtitles in `src/ui/storyUI.js`, the
memory look in `src/world/postfx.js` (a soft cold grade with more grain), rain lit by Zero's glow in
`src/world/weather.js`, the radio voice, static and the new sounds in `src/audio/music.js` and `src/audio/sound.js`, and
`src/story/chapters/chapter08.js` (only data). One change for every car: the light of the headlights on the road now
fades out softly at its edges (`makeBeamTexture` in `src/vehicles/vehicle.js`) - before, its sides were a hard line and
in a film shot from the side it looked like a white sheet lying on the road. Theo's car got a closed floor up to the
firewall (`src/vehicles/theoCar.js`), for the close-ups in the dark cabin.

## Known limits

- Traffic cars drive on lanes: when hit they are shoved along the lane and a little to the side, stop and
  honk, but they do not spin away. The parked cars of the city are solid and do not move. Vehicles you
  left behind, police, story and race cars are real: they get pushed and turned.
- Car bodies do not get dents: damage is shown with darker paint, cracked glass and smoke.
- Not done from the wish list: the Doppler effect for passing traffic, mirror-like headlight
  reflections on wet roads and separate fog lamps (the wet road only gets the normal light patch).
  The cockpit is the same simple dashboard in every car, without working dials.
- The boat cannot leave the water; you get out at the beach or at a dock in The Sunk (not into the open
  water: you can swim, but the boat does not let you jump out of it). Swimming has no diving under the water and
  no climbing animation: climbing onto a pontoon is a quick step up. The drone has no camera
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
  animation (no turning on the spot animation, no jumping). Everybody walks with a style of their own
  (see the motion pass above), but the styles are numbers on one walk, not hand-made animations.
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
- CHAPTER 4: the races were driven to the end only by a test robot (with a stronger car than yours), in a
  software renderer. How hard the rivals are, how often a player wrecks, the drift boost and the jump still need
  real play on a phone (SETTINGS → DRIVING changes the rivals). Dante wears Theo's jacket as paint on his body
  (the model has no separate clothes), and so does Nate after he takes it; in their hands the jacket is a simple folded shape. Zero's
  strike is moved by the story (not by the car physics) - it always ends the same way.
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
- CHAPTER 5 / THE DOCKS: played to the end only by a test robot in a software renderer (it drives the truck and
  the boat along written lines and is put at the gate box, it does not sneak). How hard the stealth in yard B is, how
  wide the trailer swings, the boat chase and RAM / TURN still need real play on a phone. The dock workers are simple
  figures (the same body as the city's walkers, with vests and hard hats); they do not react to the player. The
  office and the back warehouse are only seen in the film scenes (you cannot walk up the stairs). The ships do not
  move away from the quay. Rask holds his hands over the crate (there is no pose for a flat hand on it).
- CHAPTER 6 / OLD DEBTS: played to the end only by a test robot in a software renderer (it does the stations by itself
  and presses the buttons; the five stations of 6.1 were also done once with finger-like touch events on the panel, and
  each one finished); the feel of the gestures, the pace of the stories and every sound still need a real phone.
  The garage is a set of its own (the city is not drawn while it is shown, but stays loaded, so leaving is instant).
  Nate does not walk in the film scenes (the cut puts him at his next place), the car's doors do not open (he is
  simply in the seat), and the roller door does not roll up on screen (the picture goes dark). There is no upgrade shop
  in the game yet: the flags for it are saved.
- BODY LANGUAGE: tested by a robot in a software renderer, frame by frame - not watched on a real phone. The gestures
  come from rules about English words, not from understanding them: most lines get a fitting gesture, some get a
  plain beat where a person might do something else. The fingers move together (curl and spread), so there is no
  pointing index finger and no counting on fingers. The hands are not checked against things near the body: in a
  tight scene a hand can come close to a table or a wall.
- CHAPTER 8 / TALK TO ZERO: played to the end only by a test robot in a software renderer (it drives along a lane,
  holds the cars side by side and runs from the Phantoms); keeping up with Zero, the side-by-side hold, the chase and
  every sound (Theo's voice with its delay, the static, the pad, the engine ticks) still need a real phone. Chapter 7 is
  not written: its flags are only set by the `flags=` address option for now. Theo's voice is a made sound without
  words (the words are in the subtitles). In the talk the story drives both cars - you do not steer while Theo speaks.
  The cars do not really stop at a cut: the road is moved back under them (you do not see it). In Mace's old street
  car (the branch where Theo's car is not Nate's) the radio, the deck and the key sit on the plain dashboard every car
  shares, with a dark radio housing over its screen.
- Shop names, signs and adverts are invented. No real brands are used.
