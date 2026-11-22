// MIDNIGHT VAULT — tuning constants and the three jobs. A job is one building:
// an ASCII map, guard patrols, security cameras, loot spots, a vault, a
// terminal and the getaway van. Maps are 24 by 15 tiles of 40 px.
export const STEP = 1 / 60;
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 600

// Movement and senses.
export const PLAYER_SPEED = 132; // px/s walking
export const RUN_SPEED = 208; // px/s running (loud)
export const SNEAK_SPEED = 62; // px/s sneaking (quiet)
export const GUARD_SPEED = 58; // px/s on patrol
export const GUARD_CHASE_SPEED = 152; // px/s when chasing
export const CONE_RANGE = 195; // guard vision range, px
export const CONE_HALF = 0.58; // guard vision half-angle, rad
export const CAMERA_RANGE = 175; // camera vision range, px
export const CAMERA_HALF = 0.5; // camera vision half-angle, rad
export const DETECT_GAIN = 85; // suspicion per second at point blank
export const SUSPECT_AT = 55; // suspicion that turns a guard curious
export const ALARM_MAX = 100;
export const ALARM_DECAY = 3; // per second while nobody sees you
export const CAMERA_ALARM_RATE = 28; // alarm per second inside a camera cone
export const POLICE_SECONDS = 45; // countdown once the alarm maxes out
export const NOISE_RUN_RADIUS = 104; // guards hear running this far
export const NOISE_DRILL_RADIUS = 165; // guards hear drilling this far
export const SMOKE_SECONDS = 8;
export const SMOKE_RADIUS = 90;
export const CAMERA_OFF_SECONDS = 20; // terminal hack disables cameras this long

// Tools (the plan phase lets the crew pick two of four).
export const TOOLS = [
  { id: 'lockpicks', name: 'Lockpicks', cost: 'free', blurb: 'Doors open in half a second instead of three.' },
  { id: 'smoke', name: 'Smoke bombs', cost: 'free', blurb: 'X drops a smoke cloud (2 per job). Nobody sees through it.' },
  { id: 'drill', name: 'Drill rig', cost: 'free', blurb: 'The vault drills open in 4 seconds instead of 12.' },
  { id: 'disguise', name: 'Disguise', cost: 'free', blurb: 'Guards only notice you within 110 px. Cameras still see you.' },
];

// Loot values. Gold is heavy: every bar cuts your speed by 15%.
export const LOOT = {
  cash: { value: 500, weight: 0, label: 'Cash', color: '#7ee787' },
  jewels: { value: 1500, weight: 0, label: 'Jewels', color: '#7dd3fc' },
  art: { value: 2500, weight: 0.5, label: 'Art', color: '#f0abfc' },
  gold: { value: 3000, weight: 1, label: 'Gold', color: '#fbbf24' },
};

// Map legend: # wall · . floor · C crate (blocks sight) · B shadow (hides you)
// P thief start · G guard · E getaway van · V vault · D locked door
// T terminal (hack the cameras) · M camera mount (on a wall) · L loot spot
// (loot kinds are listed per job in `loot`, in the order the L tiles scan;
// `vaultLoot` is what drilling the vault open reveals.)
export const JOBS = [
  {
    name: '1 · Harbor Bank',
    brief: 'Two guards, two cameras, one vault. The gold inside is worth $3,000 — the quota is $4,000, so the vault is not optional.',
    quota: 4000,
    map: [
      '########################',
      '#P....C......B...VV.L..#',
      '#..####....M###...##...#',
      '#..#.........G.........#',
      '#..#..C......#...C.....#',
      '#..####....####........#',
      '#......................#',
      '#.B......C.....C....L..M',
      '#..####....####........#',
      '#..#..........#........#',
      '#..#..G.......#..L.....#',
      '#..####....####........#',
      '#....T..............E..#',
      '#..L.......C...........#',
      '########################',
    ],
    patrols: [
      [[7, 3], [18, 3], [18, 6], [7, 6]],
      [[7, 10], [10, 10], [10, 12], [7, 12]],
    ],
    cameras: [
      { tx: 11, ty: 2, base: 1.57, sweep: 0.85, speed: 0.45 },
      { tx: 23, ty: 7, base: 3.14, sweep: 0.8, speed: 0.35 },
    ],
    loot: ['cash', 'cash', 'jewels', 'cash'],
    vaultLoot: 'gold',
    vault: { x: 17, y: 1, w: 2, h: 1 },
  },
  {
    name: '2 · Grand Museum',
    brief: 'Three guards, three cameras, and art on every wall. The quota is $6,000 — take the art, but it slows you down.',
    quota: 6000,
    map: [
      '########################',
      '#P....C......B...VV.L..#',
      '#...###.....###.....M..#',
      '#..#......G.......#....#',
      '#..#..C......#...C.....#',
      '#..####....####........#',
      '#......................#',
      '#.B......C.....C...L...M',
      '#..####....####........#',
      '#.L...#.G..#.#.G..#....#',
      '#......................#',
      '#.C...###D...##.....#..#',
      '#..............B...M.E.#',
      '#..L.T.....C.......#...#',
      '########################',
    ],
    patrols: [
      [[7, 3], [10, 3], [10, 6], [7, 6]],
      [[10, 10], [16, 10], [16, 12], [10, 12]],
      [[15, 9], [17, 9], [17, 10], [15, 10]],
    ],
    cameras: [
      { tx: 20, ty: 2, base: 1.57, sweep: 0.9, speed: 0.5 },
      { tx: 23, ty: 7, base: 3.14, sweep: 0.8, speed: 0.4 },
      { tx: 19, ty: 12, base: -1.57, sweep: 0.85, speed: 0.45 },
    ],
    loot: ['cash', 'art', 'cash', 'art'],
    vaultLoot: 'gold',
    vault: { x: 17, y: 1, w: 2, h: 1 },
  },
  {
    name: '3 · Crown Casino',
    brief: 'Four guards, four cameras, laser-tight patrols and a $9,000 quota. The last job — make it count.',
    quota: 9000,
    map: [
      '########################',
      '#P....C......B...VV.L..#',
      '#..####....M###...##...#',
      '#..#......G......G.....#',
      '#..#..C......#...C.....#',
      '#..####....####..M.....#',
      '#......................#',
      '#.B......C.....C...L...M',
      '#..####....####........#',
      '#.L...#..G..#..G..#....#',
      '#......................#',
      '#.C...###D...##.....#..#',
      '#..............B...M.E.#',
      '#..L.T.....C.......#...#',
      '########################',
    ],
    patrols: [
      [[7, 3], [10, 3], [10, 6], [7, 6]],
      [[15, 3], [20, 3], [20, 6], [15, 6]],
      [[10, 10], [16, 10], [16, 12], [10, 12]],
      [[15, 9], [17, 9], [17, 10], [15, 10]],
    ],
    cameras: [
      { tx: 11, ty: 2, base: 1.57, sweep: 0.9, speed: 0.55 },
      { tx: 23, ty: 7, base: 3.14, sweep: 0.8, speed: 0.4 },
      { tx: 19, ty: 12, base: -1.57, sweep: 0.85, speed: 0.45 },
      { tx: 17, ty: 5, base: 1.57, sweep: 0.85, speed: 0.5 },
    ],
    loot: ['cash', 'jewels', 'art', 'art'],
    vaultLoot: 'gold',
    vault: { x: 17, y: 1, w: 2, h: 1 },
  },
];
