# PHANTOM GRID

An open-world 3D web game set in **Port Meridian**, a fictional American coastal city in the year 2090.
A realistic city of the future: sculpted glass towers, hanging gardens, sky bridges,
electric cars and a maglev line. No cartoon look, no neon-toy look.

This is **Phase 2, "Life and Driving"**: a playable, realistic first area of the city that runs in a phone browser, with cars to drive, traffic, people, a map with GPS and a first mission.
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
| Look around the car | Drag on the screen | Mouse |
| Big map + waypoint | `MAP` button or tap the minimap, then tap a place | `M`, then click a place |
| Sound on / off | `SOUND` button | same |
| Dialog | Tap the box | Click the box |

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
  ai/
    traffic.js             the other cars: lanes, traffic lights, turns, braking, honking, pulling over
    police.js              the wanted level and the police cars that chase you
    pedestrians.js         the people: sidewalks, crosswalks, red lights
  missions/
    missions.js            THE MISSIONS AS DATA - add your story here
    missionManager.js      runs the mission steps
  audio/
    sound.js               all sounds, made in code (engine, tires, horn, crash, footsteps)
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
`walk` and `run`, the game blends between them by speed. Without that file the current model
is used and slides.

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

## Known limits

- Traffic cars drive on rails: when hit they stop and honk, but they are not pushed away. Parked
  cars are solid and do not move. Vehicles you left behind and police cars do get pushed.
- Car bodies do not get dents: damage is shown with darker paint, cracked glass and smoke.
- Not done from the wish list: the Doppler effect for passing traffic, mirror-like headlight
  reflections on wet roads and separate fog lamps (the wet road only gets the normal light patch).
  The cockpit is the same simple dashboard in every car, without working dials.
- The boat cannot leave the water and you can only get out at the beach. The drone has no camera
  of its own and does not collide with trees or lamps, only with buildings.
- The police only chase by car; they do not get out and there is no shooting.
- The new driving feel was tuned with numbers and a software renderer, not on a real phone - the
  grip, steering speed and button sizes will need a round of tuning after real play.
- The car model files were scans without an inside and without separate doors. Doors, glass and
  wheels were cut out by a script, so their edges are not perfect, and all cars share one simple
  interior. Only the driver's door opens. Parked and traffic cars keep dark, solid windows.
- Tested with a software renderer only; real phone frame rates, the feel of the touch buttons, tilt
  steering and the sound still have to be checked on a real phone.
- Without the rigged model file the player has no animation.
- Buildings cannot be entered.
- Shop names, signs and adverts are invented. No real brands are used.
