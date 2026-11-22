// MIDNIGHT VAULT — headless checks for the pure world logic. No DOM, no
// canvas: this file imports game/src/world.js straight into Node and plays
// it. Run with: node scripts/headless-test.mjs  (from the entry root)
// Exits 0 when all 24 checks pass, 1 otherwise.
import { TILE } from '../game/src/config.js';
import {
  createGame,
  toggleTool,
  beginRun,
  update,
  snapshot,
  carriedValue,
  guardCanSee,
  lineOfSight,
} from '../game/src/world.js';
import { stageShot } from '../game/src/shots.js';

const DT = 1 / 60;
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function step(state, input, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) update(state, input, DT);
}

// A fresh job 1 with the given two tools.
function fresh(tools = ['lockpick', 'drill']) {
  const state = createGame(20261122);
  for (const tool of tools) toggleTool(state, tool);
  const ok = beginRun(state);
  assert(ok, 'beginRun should start with exactly two tools');
  return state;
}

// Teleport the player to a tile centre (tests only — the real game walks).
function put(state, tx, ty) {
  state.player.x = tx * TILE + TILE / 2;
  state.player.y = ty * TILE + TILE / 2;
  state.player.target = null;
}

// Force a guard to catch the player: put guard 0 in chase mode right next
// to the player and let it close the last few pixels.
function forceCatch(state) {
  put(state, 20, 2);
  const guard = state.job.guards[0];
  guard.x = state.player.x - 30;
  guard.y = state.player.y;
  guard.dir = 0;
  guard.mode = 'chase';
  guard.alert = 1;
  step(state, {}, 0.5);
}

// Collect the three loose loot pieces of job 1 by teleporting onto them.
function collectLooseLoot(state) {
  put(state, 10, 2); // cash $500
  step(state, {}, 0.1);
  put(state, 20, 2); // jewels $1,500
  step(state, {}, 0.1);
  put(state, 15, 1); // art $2,500
  step(state, {}, 0.1);
}

// --- PLAN phase -----------------------------------------------------------

check('1. PLAN picks exactly two tools', () => {
  const state = createGame(20261122);
  assert(toggleTool(state, 'lockpick') === true, 'first pick accepted');
  assert(toggleTool(state, 'smoke') === true, 'second pick accepted');
  assert(toggleTool(state, 'drill') === false, 'third pick refused');
  assert(state.tools.length === 2, 'still exactly two tools');
  assert(toggleTool(state, 'lockpick') === true, 'unpicking works');
  assert(toggleTool(state, 'drill') === true, 'a freed slot takes a new tool');
});

check('2. ENTER starts the run only with exactly two tools', () => {
  const state = createGame(20261122);
  toggleTool(state, 'lockpick');
  update(state, { enter: true }, DT);
  assert(state.phase === 'plan', 'one tool must not start the run');
  update(state, { enter: false }, DT);
  toggleTool(state, 'drill');
  update(state, { enter: true }, DT);
  assert(state.phase === 'play', 'two tools must start the run');
  assert(state.job !== null, 'job 1 is loaded');
});

// --- movement and loot ----------------------------------------------------

check('3. Movement: walking moves the player', () => {
  const state = fresh();
  const y0 = state.player.y;
  step(state, { down: true }, 1);
  assert(state.player.y > y0 + 100, `player should walk south, y ${state.player.y}`);
  assert(state.player.y < y0 + 210, 'walking speed should be near 150 px/s');
});

check('4. Loot pickup: cash is worth $500', () => {
  const state = fresh();
  put(state, 10, 2);
  step(state, {}, 0.1);
  assert(carriedValue(state.job) === 500, `carried should be 500, got ${carriedValue(state.job)}`);
  assert(state.job.carried[0].kind === 'cash', 'the carried item should be cash');
});

check('5. Van below quota does not clear the job', () => {
  const state = fresh();
  put(state, 1, 14);
  step(state, {}, 0.2);
  assert(state.phase === 'play', 'job must keep running below quota');
});

check('6. Van with quota clears the job', () => {
  const state = fresh();
  collectLooseLoot(state);
  assert(carriedValue(state.job) === 4500, 'bag should hold $4,500');
  put(state, 1, 14);
  step(state, {}, 0.2);
  assert(state.phase === 'jobClear', `phase should be jobClear, got ${state.phase}`);
  assert(state.lastClear.loot === 4500, 'clear should record the loot');
});

// --- guards ---------------------------------------------------------------

check('7. Guard turns suspicious (?) on brief sight', () => {
  const state = fresh();
  put(state, 23, 1); // dead ahead of guard 0, inside its cone
  step(state, {}, 0.5);
  const guard = state.job.guards[0];
  assert(guard.mode === 'suspicious', `guard should be suspicious, got ${guard.mode}`);
  assert(guard.seeing === true, 'guard should see the player');
});

check('8. Guard chases (!) on sustained sight', () => {
  const state = fresh();
  put(state, 23, 1);
  step(state, {}, 1.3);
  const guard = state.job.guards[0];
  assert(guard.mode === 'chase', `guard should chase, got ${guard.mode}`);
  assert(state.phase === 'play', 'player must not be caught yet');
});

check('9. Wall blocks line of sight', () => {
  const state = fresh();
  const guard = state.job.guards[0];
  guard.x = 8 * TILE + TILE / 2;
  guard.y = 1 * TILE + TILE / 2;
  // A wall sits between row 1 and row 7 in column 8.
  assert(
    lineOfSight(state.job, 8 * TILE + 16, 3 * TILE + 16, 8 * TILE + 16, 7 * TILE + 16) === false,
    'wall must block the segment',
  );
  assert(
    lineOfSight(state.job, 8 * TILE + 16, 1 * TILE + 16, 8 * TILE + 16, 3 * TILE + 16) === true,
    'open floor must not block the segment',
  );
  put(state, 8, 7);
  update(state, {}, DT);
  guard.dir = Math.PI / 2; // facing south, straight at the player
  assert(guardCanSee(state.job, guard, state.tools) === false, 'guard must not see through a wall');
  put(state, 8, 3);
  update(state, {}, DT);
  guard.dir = Math.PI / 2;
  assert(guardCanSee(state.job, guard, state.tools) === true, 'guard must see across open floor');
});

// --- cameras --------------------------------------------------------------

check('10. Camera sweeps over time', () => {
  const state = fresh();
  const cam = state.job.cameras[0];
  const angles = [];
  for (let i = 0; i < 12; i++) {
    step(state, {}, 0.25);
    angles.push(cam.angle);
  }
  const spread = Math.max(...angles) - Math.min(...angles);
  assert(spread > 0.05, `camera angle should sweep, spread ${spread}`);
});

check('11. Camera raises the alarm directly', () => {
  const state = fresh();
  put(state, 16, 7); // due west of camera 1, in its sweep, far from guards
  step(state, {}, 5);
  assert(state.job.alarm > 5, `alarm should rise under a camera, got ${state.job.alarm}`);
});

check('12. Terminal hack disables cameras for 20s', () => {
  const state = fresh();
  put(state, 15, 10); // on the terminal
  step(state, { interact: true }, 2.5);
  const disabled = state.job.cameras.filter((c) => state.job.jobTime < c.disabledUntil).length;
  assert(disabled === 2, `both cameras should be disabled, got ${disabled}`);
});

// --- vault ----------------------------------------------------------------

check('13. Vault drill takes 12s without the rig', () => {
  const state = fresh(['lockpick', 'smoke']);
  put(state, 11, 7); // inside the vault room, next to the vault
  step(state, { interact: true }, 6);
  assert(state.job.vault.open === false, 'vault must still be shut at 6s');
  step(state, { interact: true }, 6.5);
  assert(state.job.vault.open === true, 'vault must open after 12s of drilling');
});

check('14. Vault drill takes 4s with the rig', () => {
  const state = fresh(['lockpick', 'drill']);
  put(state, 11, 7);
  step(state, { interact: true }, 2);
  assert(state.job.vault.open === false, 'vault must still be shut at 2s');
  step(state, { interact: true }, 2.5);
  assert(state.job.vault.open === true, 'vault must open after 4s with the rig');
});

// --- smoke ----------------------------------------------------------------

check('15. Smoke blocks guard sight', () => {
  const state = fresh(['smoke', 'drill']);
  put(state, 23, 1);
  step(state, {}, 0.5);
  const guard = state.job.guards[0];
  assert(guard.mode === 'suspicious', 'guard should be suspicious before the smoke');
  step(state, { smoke: true }, 0.1); // drop a bomb on the player
  assert(state.job.smokesLeft === 1, 'one bomb should be spent');
  step(state, {}, 1.5);
  assert(guard.seeing === false, 'guard must not see through smoke');
  assert(guard.mode === 'patrol', `guard should give up, got ${guard.mode}`);
});

// --- getting caught ---------------------------------------------------------

check('16. Caught: lose half the loot', () => {
  const state = fresh();
  state.job.carried.push({ kind: 'cash', value: 500 });
  state.job.carried.push({ kind: 'jewels', value: 1500 });
  state.job.carried.push({ kind: 'art', value: 2500 });
  forceCatch(state);
  assert(state.job.caught === 1, 'caught counter should be 1');
  assert(carriedValue(state.job) === 2000, `half the loot should remain, got ${carriedValue(state.job)}`);
  assert(state.phase === 'play', 'one catch must not end the job');
});

check('17. Caught: respawn at the entrance', () => {
  const state = fresh();
  forceCatch(state);
  assert(state.player.x === state.job.spawn.x, 'player should respawn at the entrance x');
  assert(state.player.y === state.job.spawn.y, 'player should respawn at the entrance y');
  assert(state.job.alarm === 0, 'alarm should reset after being caught');
});

check('18. Three catches bust the job', () => {
  const state = fresh();
  forceCatch(state);
  forceCatch(state);
  forceCatch(state);
  assert(state.phase === 'busted', `phase should be busted, got ${state.phase}`);
  assert(state.bustedReason === 'caught', `reason should be caught, got ${state.bustedReason}`);
});

// --- police countdown -------------------------------------------------------

check('19. Full alarm starts the 45s police countdown', () => {
  const state = fresh();
  put(state, 23, 1); // guard 0 sees the player
  state.job.alarm = 99;
  step(state, {}, 0.2);
  assert(state.job.policeTimer !== null, 'police countdown should start');
  assert(
    state.job.policeTimer > 44 && state.job.policeTimer <= 45,
    `countdown should start at 45s, got ${state.job.policeTimer}`,
  );
  assert(state.job.alarmEverFull === true, 'alarm should record having maxed out');
});

check('20. Police countdown expiring busts the job', () => {
  const state = fresh();
  put(state, 23, 1);
  state.job.alarm = 99;
  step(state, {}, 0.2);
  assert(state.job.policeTimer !== null, 'countdown should be running');
  put(state, 1, 1); // hide at the spawn while the clock runs
  step(state, {}, 46);
  assert(state.phase === 'busted', `phase should be busted, got ${state.phase}`);
  assert(state.bustedReason === 'police', `reason should be police, got ${state.bustedReason}`);
});

// --- scoring and determinism ------------------------------------------------

check('21. Ghost bonus: $500 when the alarm never maxes', () => {
  const state = fresh();
  collectLooseLoot(state);
  put(state, 1, 14);
  step(state, {}, 0.2);
  assert(state.phase === 'jobClear', 'job should clear');
  assert(state.lastClear.ghostBonus === 500, `ghost bonus should be 500, got ${state.lastClear.ghostBonus}`);
});

check('22. Score is loot + job + time + ghost bonus', () => {
  const state = fresh();
  collectLooseLoot(state);
  put(state, 1, 14);
  step(state, {}, 0.2);
  const c = state.lastClear;
  assert(c.jobBonus === 1000, `job 1 bonus should be 1000, got ${c.jobBonus}`);
  assert(
    c.total === c.loot + c.jobBonus + c.timeBonus + c.ghostBonus,
    'total must be the sum of its parts',
  );
  assert(state.score === c.total, 'score must equal the clear total');
});

check('23. Same seed replays the same run', () => {
  const run = () => {
    const state = fresh();
    step(state, { right: true }, 1);
    step(state, { up: true }, 0.5);
    step(state, { left: true, run: true }, 0.5);
    step(state, {}, 0.5);
    return JSON.stringify(snapshot(state));
  };
  const a = run();
  const b = run();
  assert(a === b, 'identical inputs on one seed must give identical snapshots');
});

check('24. All four shot scenes stage correctly', () => {
  const plan = stageShot('plan');
  assert(plan.phase === 'plan', 'plan scene stays in PLAN');
  assert(plan.tools.length === 2, 'plan scene preselects two tools');
  const play = stageShot('play');
  assert(play.phase === 'play', 'play scene is mid-job');
  const alert = stageShot('alert');
  assert(alert.job.alarm === 82, `alert scene alarm should be 82, got ${alert.job.alarm}`);
  assert(alert.job.guards[0].mode === 'chase', 'alert scene guard should chase');
  const end = stageShot('end');
  assert(end.phase === 'jobClear', `end scene should clear job 1, got ${end.phase}`);
  assert(end.lastClear.loot === 6000, `end scene loot should be 6000, got ${end.lastClear.loot}`);
});

console.log(`\n${passed}/24 checks passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
