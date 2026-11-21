// ---------------------------------------------------------------------------
// missions.js - THE MISSIONS, as plain data. Add your own story here.
//
// A mission is a list of STEPS. The player does them one after the other.
//
// STEP TYPES
//   goto      walk or drive to a place
//             { type: 'goto', text, target, radius }
//   enterCar  get into a car
//             { type: 'enterCar', text, car: 'name of a mission car' }   (leave "car" out = any car)
//   driveTo   reach a place while sitting in a car
//             { type: 'driveTo', text, target, radius }
//   wait      stay for some seconds (in a car: the car must stand still)
//             { type: 'wait', text, seconds }
//   timer     like goto, but with a time limit. If the time runs out the
//             mission goes back to step "failTo" (0 = the first step).
//             { type: 'timer', text, target, radius, seconds, failTo }
//   dialog    a box with a name and some lines of text; a tap shows the next line
//             { type: 'dialog', name, lines: ['...', '...'] }
//
// A "target" is a place: { x, z }  or a mission car: { car: 'name' }.
// Map directions: +z is north, -z is south, -x is east, +x is west.
//
// "cars" are put into the world when the mission starts:
//   { name, kind: 'sedan' | 'suv' | 'van' | 'coupe' | 'armored_van' | 'small_city_car' | ..., x, z, facing (compass degrees), color: [r, g, b] }
//   (model cars keep their own colors: use [1, 1, 1])
// "next": the id of the mission that starts by itself after this one.
// ---------------------------------------------------------------------------

export const MISSIONS = [
  {
    id: 'meet-at-neon-mile',
    title: 'MEET AT NEON MILE',
    cars: [
      // an orange sports coupe, parked at the west curb of the start street, nose to the south
      { name: 'ride', kind: 'coupe', x: -1.3, z: 97, facing: 180, color: [0.85, 0.36, 0.05] },
    ],
    steps: [
      { type: 'goto', text: 'Walk to the orange sports car across the street', target: { car: 'ride' }, radius: 4.5 },
      { type: 'enterCar', text: 'Get in: press CAR (or key E)', car: 'ride' },
      { type: 'driveTo', text: 'Drive south to Neon Mile and turn right at the beach', target: { x: 42, z: -388 }, radius: 10 },
      { type: 'wait', text: 'Stop the car', seconds: 1.5 },
      {
        type: 'dialog', name: 'MARA VELLANI',
        lines: [
          'You made it. Nice car - try to bring it back in one piece.',
          'Kessler-Vance is moving something through The Crown tonight. I will call you when I know more.',
        ],
      },
    ],
    done: 'MISSION COMPLETE',
    next: 'armored-run',
  },
  {
    id: 'armored-run',
    title: 'THE ARMORED RUN',
    cars: [
      // the heavy armored van, parked at the east curb of the start street near the beach, nose to the north
      { name: 'van', kind: 'armored_van', x: -12.7, z: -338, facing: 0, color: [1, 1, 1] },
    ],
    steps: [
      { type: 'dialog', name: 'MARA VELLANI', lines: ['One more thing. There is an armored van one block north of the beach. It is heavy and slow - and it has to be at the garage before anyone misses it.'] },
      { type: 'goto', text: 'Go to the armored van north of Neon Mile', target: { car: 'van' }, radius: 6 },
      { type: 'enterCar', text: 'Get into the armored van', car: 'van' },
      { type: 'timer', text: 'Drive the van north to the garage at the start point', target: { x: -8, z: 112 }, radius: 11, seconds: 150, failTo: 1 },
      { type: 'wait', text: 'Stop the van', seconds: 1.5 },
      { type: 'dialog', name: 'MARA VELLANI', lines: ['Not a scratch? I am impressed. The garage will take it from here.'] },
    ],
    done: 'MISSION COMPLETE',
  },
];
