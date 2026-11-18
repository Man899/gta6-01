// Tuning and layout constants for Port Solano. One place holds every number the
// rest of the game reads, so balancing is editing here, not hunting through files.
export const STEP = 1 / 60;

// The city is a grid of blocks separated by roads. Roads run along the lines
// x = i * PITCH and z = j * PITCH; blocks sit between them.
export const PITCH = 58; // distance between neighbouring road centrelines, metres
export const ROAD_HALF = 6; // half the width of a road
export const GRID = 3; // roads at -3..3 in each axis, so 7 by 7 roads
export const CITY_HALF = GRID * PITCH + ROAD_HALF; // outer edge of the drivable city

// Player on foot.
export const WALK_SPEED = 7;
export const RUN_SPEED = 11;
export const PLAYER_RADIUS = 0.55;
export const PLAYER_HEIGHT = 1.8;

// Cars.
export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 2.0;
export const DRIVE_TOP_SPEED = 34;
export const DRIVE_ACCEL = 16;
export const DRIVE_BRAKE = 30;
export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 10;
export const TRAFFIC_SPEED = 9;

// People.
export const PED_COUNT = 26;
export const PED_SPEED = 1.6;

// Wanted level: heat 0..100, stars are heat in steps of 20.
export const HEAT_MAX = 100;
export const HEAT_PER_STAR = 20;
export const HEAT_DECAY = 2.2; // heat lost per second while laying low
export const HEAT_STEAL_CAR = 25;
export const HEAT_HIT_PED = 30;
export const HEAT_ATTACK_COP = 40;
export const HEAT_SHOOT = 20;
export const MAX_POLICE_CARS = 5;
export const POLICE_RAM_SPEED = 26;

// Health and money.
export const HEALTH_MAX = 100;
export const MONEY_START = 500;
export const BUST_FINE = 300;

// Missions: id, title, story lines, reward. The mission module owns the flow;
// this table is the script the player reads.
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'First Pickup',
    reward: 800,
    intro: 'Marta Reyes: "Danny, a package is waiting at the north docks. Bring it to my garage — and try not to scratch the paint."',
    steps: [
      { kind: 'goto', label: 'Pick up the package at the north docks', target: { x: -58, z: -174 } },
      { kind: 'goto', label: 'Deliver the package to Marta’s garage', target: { x: 116, z: 116 } },
    ],
  },
  {
    id: 'clock',
    title: 'Beat the Clock',
    reward: 1200,
    intro: 'Marta Reyes: "A client needs three drops across town, and the clock is already running. Drive like you mean it."',
    timeLimit: 150,
    steps: [
      { kind: 'goto', label: 'Drop 1: the marina kiosk', target: { x: -174, z: 58 } },
      { kind: 'goto', label: 'Drop 2: the market square', target: { x: 58, z: -58 } },
      { kind: 'goto', label: 'Drop 3: the hilltop lookout', target: { x: 174, z: -174 } },
    ],
  },
  {
    id: 'heat',
    title: 'Lose the Heat',
    reward: 2000,
    intro: 'Marta Reyes: "The whole force is on you after that last job. Lay low, break line of sight, and get clean — then meet me at the garage."',
    steps: [
      { kind: 'lose', label: 'Lose the police — get your wanted level to zero' },
      { kind: 'goto', label: 'Meet Marta at the garage', target: { x: 116, z: 116 } },
    ],
  },
];

// Where the player starts: the plaza at the south-west corner of the city.
export const SPAWN = { x: -174, z: 174, yaw: Math.PI * 0.75 };
export const GARAGE = { x: 116, z: 116 };

export const SAVE_KEY = 'portsolano-save-v1';
