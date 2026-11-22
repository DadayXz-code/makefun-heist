// Static configuration for MIDNIGHT VAULT: board size, tools, loot values,
// tuning numbers and the three job maps (ASCII, one per job).
//
// Map legend:
//   #  wall            B  crate (blocks movement and sight)
//   .  floor           D  locked door
//   T  terminal        V  vault (drill it open)
//   c  cash $500       j  jewels $1,500
//   a  art $2,500      P  player spawn
//   C  camera          E  getaway van
// Rows may be ragged; the parser pads short rows with wall.

export const TILE = 32;
export const MAP_COLS = 26;
export const MAP_ROWS = 16;
export const VIEW_W = MAP_COLS * TILE;
export const VIEW_H = MAP_ROWS * TILE;

export const PLAYER_RADIUS = 11;
export const WALK_SPEED = 150;
export const RUN_SPEED = 228;
export const SNEAK_SPEED = 74;
export const GUARD_PATROL_SPEED = 56;
export const GUARD_CHASE_SPEED = 136;
export const GUARD_SUSPICIOUS_SPEED = 84;

export const GUARD_SIGHT_RANGE = 225;
export const GUARD_SIGHT_RANGE_DISGUISED = 110;
export const GUARD_HALF_ANGLE = 0.62; // ~35 degrees each side
export const GUARD_SUSPICIOUS_AFTER = 0.35; // seconds of sight -> "?"
export const GUARD_CHASE_AFTER = 1.1; // seconds of sight -> "!"
export const GUARD_HEAR_RUN_RANGE = 175;
export const GUARD_HEAR_DRILL_RANGE = 285;
export const GUARD_CATCH_RANGE = 24;

export const CAMERA_RANGE = 250;
export const CAMERA_HALF_ANGLE = 0.5;
export const CAMERA_SWEEP = 0.65; // radians of swing each side
export const CAMERA_SWEEP_SPEED = 0.55;
export const CAMERA_DISABLE_SECONDS = 20;

export const ALARM_MAX = 100;
export const ALARM_GUARD_RATE = 25; // per second while any guard sees you
export const ALARM_CAMERA_RATE = 30; // per second while a camera sees you
export const ALARM_DECAY_RATE = 4; // per second while unseen
export const POLICE_SECONDS = 45;

export const LOCKPICK_SECONDS = 0.5;
export const DOOR_SECONDS_NO_PICK = 2.5;
export const HACK_SECONDS = 2;
export const DRILL_SECONDS_WITH_RIG = 4;
export const DRILL_SECONDS_NO_RIG = 12;
export const INTERACT_RANGE = 52;

export const SMOKE_PER_JOB = 2;
export const SMOKE_RADIUS = 72;
export const SMOKE_SECONDS = 8;

export const MAX_CAUGHT = 3;
export const GHOST_BONUS = 500;
export const JOB_BONUS = [1000, 1500, 2000];
export const JOB_PAR_SECONDS = [180, 240, 300];

// How much each loot kind slows the thief: heavier loot, slower feet.
export const LOOT_WEIGHT = { cash: 0, jewels: 1, art: 2, gold: 3 };
export const LOOT_VALUE = { cash: 500, jewels: 1500, art: 2500, gold: 3000 };
export const LOOT_LABEL = {
  cash: 'Cash',
  jewels: 'Jewels',
  art: 'Art',
  gold: 'Gold bars',
};

export const TOOLS = [
  {
    id: 'lockpick',
    name: 'Lockpicks',
    key: '1',
    blurb: 'Pick a locked door in 0.5s instead of 2.5s.',
  },
  {
    id: 'smoke',
    name: 'Smoke bombs',
    key: '2',
    blurb: 'Press X to drop smoke (2 per job). Smoke blocks every eye.',
  },
  {
    id: 'drill',
    name: 'Drill rig',
    key: '3',
    blurb: 'Drill the vault open in 4s instead of 12s. Loud either way.',
  },
  {
    id: 'disguise',
    name: 'Disguise',
    key: '4',
    blurb: 'Guards ignore you beyond 110 px. Cameras still see you.',
  },
];

export const JOBS = [
  {
    name: 'Harbor Bank',
    quota: 4000,
    map: [
      '##########################',
      '#P...#.........a.........#',
      '#....D....c....#....j....#',
      '#....#.........#.........#',
      '#....#....B....#....B....#',
      '#....#######D###....C....#',
      '#....#....#...#..........#',
      '#....#....#.V.#....C.....#',
      '#....#....#...#..........#',
      '#....#######D###....B....#',
      '#....#.........T.........#',
      '#....D....c....#....j....#',
      '#....#...................#',
      '#....#.........B.........#',
      '#E...#...................#',
      '##########################',
    ],
    guards: [
      { x: 19, y: 1, waypoints: [[19, 1], [23, 1], [23, 3], [19, 3]] },
      { x: 18, y: 11, waypoints: [[18, 11], [23, 11], [23, 13], [18, 13]] },
    ],
  },
  {
    name: 'Grand Museum',
    quota: 6000,
    map: [
      '##########################',
      '#P...#....a....#....j....#',
      '#....D....c....D....c....#',
      '#....#.........#.........#',
      '#....#....B....#....B....#',
      '#....#######D###....C....#',
      '#....#....#...#..........#',
      '#....#....#.V.#....C.....#',
      '#....#....#...#..........#',
      '#....#######D###....B....#',
      '#....#....a....T....j....#',
      '#....D....c....#.........#',
      '#....#...................#',
      '#....#....B....#....C....#',
      '#E...#...................#',
      '##########################',
    ],
    guards: [
      { x: 18, y: 1, waypoints: [[18, 1], [23, 1], [23, 3], [18, 3]] },
      { x: 7, y: 11, waypoints: [[7, 11], [14, 11], [14, 12], [7, 12]] },
      { x: 18, y: 11, waypoints: [[18, 11], [23, 11], [23, 13], [18, 13]] },
    ],
  },
  {
    name: 'Crown Casino',
    quota: 9000,
    map: [
      '##########################',
      '#P...#....j....#....a....#',
      '#....D....c....D....j....#',
      '#....#....a....#....c....#',
      '#....#....B....#....B....#',
      '#....#######D###....C....#',
      '#....#....#...#.....C....#',
      '#....#....#.V.#..........#',
      '#....#....#...#....C.....#',
      '#....#######D###....B....#',
      '#....#....a....T....j....#',
      '#....D....c....#....c....#',
      '#....#.........B.........#',
      '#....#....C....#.........#',
      '#E...#...................#',
      '##########################',
    ],
    guards: [
      { x: 18, y: 1, waypoints: [[18, 1], [23, 1], [23, 3], [18, 3]] },
      { x: 7, y: 1, waypoints: [[7, 1], [13, 1], [13, 3], [7, 3]] },
      { x: 8, y: 11, waypoints: [[8, 11], [13, 11], [13, 13], [8, 13]] },
      { x: 18, y: 11, waypoints: [[18, 11], [23, 11], [23, 13], [18, 13]] },
    ],
  },
];
