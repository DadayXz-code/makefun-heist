// MIDNIGHT VAULT headless test: exercises world.js (and the end-to-end shot
// staging in shots.js) with no DOM and no canvas. Run from the entry root:
//   node scripts/headless-test.mjs
// Exit 0 prints HEADLESS TEST PASSED 24/24; any failed assert exits 1.
import { createWorld, EVENT_CLEAR, EVENT_BUSTED, EVENT_CAUGHT } from '../game/src/world.js';
import { createRandom } from '../game/src/random.js';
import { STEP, TILE } from '../game/src/config.js';
import { applyShot, END_TOOLS } from '../game/src/shots.js';
import { SCREEN_CLEAR } from '../game/src/render.js';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const idle = { x: 0, y: 0, run: false, sneak: false, interact: false, smoke: false };
const fresh = (job = 0, tools = []) => createWorld(createRandom(7), job, tools);

// Freeze a guard on one spot so a test controls exactly what he faces.
function pinGuard(world, gi, x, y, angle) {
  const g = world.state.guards[gi];
  g.x = x;
  g.y = y;
  g.angle = angle;
  g.patrol = [{ x, y }];
  g.waypoint = 0;
  return g;
}

// Pin every guard far from the action (bottom-left corner, single point).
function pinAllGuards(world) {
  world.state.guards.forEach((g, i) => pinGuard(world, i, (1.5 + i) * TILE, 13.5 * TILE, 0));
}

function stepN(world, n, input = idle) {
  let events = 0;
  for (let i = 0; i < n; i += 1) events |= world.step(STEP, input, 0);
  return events;
}

// 1. Guards patrol: guard 0 walks his waypoints and stays on patrol.
{
  const w = fresh();
  const g0 = w.state.guards[0];
  const x0 = g0.x, y0 = g0.y;
  stepN(w, 300); // 5 s
  const moved = Math.hypot(g0.x - x0, g0.y - y0);
  check('patrol: guard 0 moves along his route', moved > 40 && g0.state === 'patrol', `moved ${moved.toFixed(0)} px in 5 s, state ${g0.state}`);
}

// 2. Detection in the open: a player dead-centre in the cone gets spotted,
//    suspected, then chased (alert).
{
  const w = fresh();
  const g = pinGuard(w, 0, 12.5 * TILE, 6.5 * TILE, 0); // open row 6, facing east
  let sawAlert = false;
  for (let i = 0; i < 180; i += 1) { // 3 s
    w.state.player.x = g.x + 100;
    w.state.player.y = g.y;
    g.angle = 0;
    w.step(STEP, idle, 0);
    if (g.state === 'alert') sawAlert = true;
  }
  check('detection: open sighting raises suspicion to alert', sawAlert, `suspicion ${g.suspicion.toFixed(0)}, state ${g.state}`);
}

// 3. A wall blocks sight: same geometry, wall between guard and player.
{
  const w = fresh();
  const g = pinGuard(w, 0, 2.5 * TILE, 3.5 * TILE, 0); // west of the row-3 wall
  w.state.player.x = 6.5 * TILE; // east of the same wall, still in range
  w.state.player.y = 3.5 * TILE;
  stepN(w, 180);
  check('detection: wall blocks sight', g.suspicion === 0 && g.state === 'patrol', `suspicion ${g.suspicion.toFixed(0)}, state ${g.state}`);
}

// 4. A crate blocks sight: a C tile between guard and player.
{
  const w = fresh();
  const g = pinGuard(w, 0, 4.5 * TILE, 4.5 * TILE, 0); // west of the row-4 crate
  w.state.player.x = 8.5 * TILE; // east of the crate, still in range
  w.state.player.y = 4.5 * TILE;
  stepN(w, 180);
  check('detection: crate blocks sight', g.suspicion === 0 && g.state === 'patrol', `suspicion ${g.suspicion.toFixed(0)}, state ${g.state}`);
}

// 5. Smoke blocks sight: a player inside a smoke cloud is not seen.
{
  const w = fresh(0, ['smoke']);
  const g = pinGuard(w, 0, 12.5 * TILE, 7.5 * TILE, 0);
  w.state.player.x = g.x + 100;
  w.state.player.y = g.y;
  w.step(STEP, { ...idle, smoke: true }, 0); // drop the cloud on the player
  for (let i = 0; i < 180; i += 1) {
    w.state.player.x = g.x + 100;
    w.state.player.y = g.y;
    g.angle = 0;
    w.step(STEP, idle, 0);
  }
  check('detection: smoke blocks sight', g.suspicion === 0 && g.state === 'patrol', `suspicion ${g.suspicion.toFixed(0)}, clouds ${w.state.smokes.length}`);
}

// 6. A shadow tile (B) slows detection to ~30% of the open-floor rate.
{
  const shadow = fresh();
  const gs = pinGuard(shadow, 0, 5.5 * TILE, 7.5 * TILE, Math.PI); // facing the B tile
  shadow.state.player.x = 2.5 * TILE;
  shadow.state.player.y = 7.5 * TILE;
  stepN(shadow, 60);
  const open = fresh();
  const go = pinGuard(open, 0, 5.5 * TILE, 7.5 * TILE, 0); // facing open floor
  open.state.player.x = 8.5 * TILE;
  open.state.player.y = 7.5 * TILE;
  stepN(open, 60);
  check('detection: shadow tile slows suspicion', gs.suspicion < go.suspicion * 0.5 && go.suspicion > 40, `shadow ${gs.suspicion.toFixed(1)}, open ${go.suspicion.toFixed(1)}`);
}

// 7. Sneaking halves the detection rate.
{
  const sneak = fresh();
  const gs = pinGuard(sneak, 0, 12.5 * TILE, 7.5 * TILE, 0);
  for (let i = 0; i < 60; i += 1) {
    sneak.state.player.x = gs.x + 100;
    sneak.state.player.y = gs.y;
    gs.angle = 0;
    sneak.step(STEP, { ...idle, sneak: true }, 0);
  }
  const loud = fresh();
  const gl = pinGuard(loud, 0, 12.5 * TILE, 7.5 * TILE, 0);
  for (let i = 0; i < 60; i += 1) {
    loud.state.player.x = gl.x + 100;
    loud.state.player.y = gl.y;
    gl.angle = 0;
    loud.step(STEP, idle, 0);
  }
  check('detection: sneaking halves suspicion gain', gs.suspicion < gl.suspicion * 0.6 && gl.suspicion > 40, `sneak ${gs.suspicion.toFixed(1)}, walk ${gl.suspicion.toFixed(1)}`);
}

// 8. Disguise shrinks the guard's range to 110 px.
{
  const plain = fresh();
  const gp = pinGuard(plain, 0, 12.5 * TILE, 6.5 * TILE, 0); // open row 6, facing east
  for (let i = 0; i < 120; i += 1) {
    plain.state.player.x = gp.x + 150;
    plain.state.player.y = gp.y;
    gp.angle = 0;
    plain.step(STEP, idle, 0);
  }
  const hidden = fresh(0, ['disguise']);
  const gh = pinGuard(hidden, 0, 12.5 * TILE, 6.5 * TILE, 0); // open row 6, facing east
  for (let i = 0; i < 120; i += 1) {
    hidden.state.player.x = gh.x + 150;
    hidden.state.player.y = gh.y;
    gh.angle = 0;
    hidden.step(STEP, idle, 0);
  }
  check('tools: disguise hides you beyond 110 px', gp.suspicion > 50 && gh.suspicion === 0, `plain ${gp.suspicion.toFixed(0)}, disguised ${gh.suspicion.toFixed(0)}`);
}

// 9. A camera that sees the player raises the alarm.
{
  const w = fresh();
  pinAllGuards(w);
  w.state.player.x = 11.5 * TILE;
  w.state.player.y = 5 * TILE; // dead centre of camera 1's sweep
  let sawSees = false;
  for (let i = 0; i < 90; i += 1) {
    w.step(STEP, idle, 0);
    if (w.state.cameras[0].sees) sawSees = true;
  }
  check('cameras: being seen raises the alarm', sawSees && w.state.alarm > 20, `alarm ${w.state.alarm.toFixed(1)}`);
}

// 10. Hacking the terminal disables the cameras: no alarm while they are off.
{
  const w = fresh();
  // Pin the guards top-right: the bottom-left pins can see the terminal.
  w.state.guards.forEach((g, i) => pinGuard(w, i, (22.5 - i) * TILE, 1.5 * TILE, 0));
  w.state.player.x = 5.5 * TILE;
  w.state.player.y = 12.5 * TILE; // on the terminal
  stepN(w, 150, { ...idle, interact: true }); // 2.5 s hold
  const hacked = w.state.terminal.used && w.state.camerasOff > 15;
  w.state.player.x = 11.5 * TILE;
  w.state.player.y = 5 * TILE; // back in camera 1's sweep
  stepN(w, 120);
  check('terminal: hack disables cameras', hacked && w.state.alarm === 0, `camerasOff ${w.state.camerasOff.toFixed(1)}, alarm ${w.state.alarm.toFixed(1)}`);
}

// 11. Vault drill: 12 s without the rig, 4 s with it.
{
  const slow = fresh();
  pinAllGuards(slow);
  slow.state.player.x = 17.5 * TILE;
  slow.state.player.y = 2.5 * TILE; // the drill stand below the vault
  stepN(slow, 360, { ...idle, interact: true }); // 6 s
  const fast = fresh(0, ['drill']);
  pinAllGuards(fast);
  fast.state.player.x = 17.5 * TILE;
  fast.state.player.y = 2.5 * TILE;
  stepN(fast, 300, { ...idle, interact: true }); // 5 s
  check('vault: drill rig cracks it in 4 s, bare hands take 12 s', !slow.state.vault.open && slow.state.vault.progress > 0.45 && slow.state.vault.progress < 0.55 && fast.state.vault.open, `slow ${slow.state.vault.progress.toFixed(2)}, fast open=${fast.state.vault.open}`);
}

// 12. Drilling the vault open drops the gold, and it can be picked up.
{
  const w = fresh(0, ['drill']);
  pinAllGuards(w);
  w.state.player.x = 17.5 * TILE;
  w.state.player.y = 2.5 * TILE;
  stepN(w, 300, { ...idle, interact: true });
  stepN(w, 5);
  check('vault: gold slides out and is picked up', w.state.vault.open && w.state.player.lootValue === 3000, `loot $${w.state.player.lootValue}`);
}

// 13. A locked door blocks movement until picked; lockpicks are 6x faster.
{
  const slow = fresh(1); // Grand Museum has the locked door
  slow.state.guards.forEach((g, i) => pinGuard(slow, i, (1.5 + i) * TILE, 13.5 * TILE, 0));
  const solidBefore = slow.isSolidPx(9.5 * TILE, 11.5 * TILE);
  slow.state.player.x = 9.5 * TILE;
  slow.state.player.y = 10.5 * TILE; // beside the door
  stepN(slow, 210, { ...idle, interact: true }); // 3.5 s
  const fast = fresh(1, ['lockpicks']);
  fast.state.guards.forEach((g, i) => pinGuard(fast, i, (1.5 + i) * TILE, 13.5 * TILE, 0));
  fast.state.player.x = 9.5 * TILE;
  fast.state.player.y = 10.5 * TILE;
  stepN(fast, 60, { ...idle, interact: true }); // 1 s
  check('doors: locked until picked, lockpicks 6x faster', solidBefore && slow.state.doors[0].open && !slow.isSolidPx(9.5 * TILE, 11.5 * TILE) && fast.state.doors[0].open, `slow open=${slow.state.doors[0].open}, fast open=${fast.state.doors[0].open}`);
}

// 14. Loot pickup: walking onto a loot spot banks its value.
{
  const w = fresh();
  w.state.player.x = 3.5 * TILE;
  w.state.player.y = 13.5 * TILE; // the cash at (3,13)
  stepN(w, 1);
  check('loot: pickup banks $500 cash', w.state.player.lootValue === 500 && w.state.score === 500 && w.state.player.carrying.length === 1, `loot $${w.state.player.lootValue}`);
}

// 15. The van only counts with the quota: below it nothing, at it CLEAR.
{
  const short = fresh();
  short.state.player.x = 20.5 * TILE;
  short.state.player.y = 12.5 * TILE; // the van
  const e1 = stepN(short, 1);
  const rich = fresh();
  rich.state.player.lootValue = 4000;
  rich.state.player.x = 20.5 * TILE;
  rich.state.player.y = 12.5 * TILE;
  const e2 = stepN(rich, 1);
  check('van: quota gates the getaway', short.state.status === 'play' && !(e1 & EVENT_CLEAR) && (e2 & EVENT_CLEAR) && rich.state.status === 'clear' && rich.state.score === 2000, `short ${short.state.status}, rich ${rich.state.status} score ${rich.state.score}`);
}

// 16. Getting caught costs half the loot (most valuable first) and respawns you.
{
  const w = fresh();
  const p = w.state.player;
  p.carrying = [{ x: 0, y: 0, kind: 'cash', taken: true }, { x: 0, y: 0, kind: 'jewels', taken: true }];
  p.lootValue = 2000;
  const g = pinGuard(w, 0, 12.5 * TILE, 7.5 * TILE, 0);
  g.state = 'alert';
  g.suspicion = 100;
  p.x = g.x + 10;
  p.y = g.y;
  const events = stepN(w, 1);
  check('caught: half the loot dropped, respawn at the door', (events & EVENT_CAUGHT) && w.state.catches === 1 && p.lootValue === 500 && p.carrying.length === 1 && p.x === w.state.start.x && w.state.alarm > 55 && !w.state.ghost, `catches ${w.state.catches}, loot $${p.lootValue}, alarm ${w.state.alarm}`);
}

// 17. Three catches bust the job.
{
  const w = fresh();
  w.state.catches = 2;
  const g = pinGuard(w, 0, 12.5 * TILE, 7.5 * TILE, 0);
  g.state = 'alert';
  g.suspicion = 100;
  w.state.player.x = g.x + 10;
  w.state.player.y = g.y;
  const events = stepN(w, 1);
  check('caught x3: third catch busts the job', (events & EVENT_BUSTED) && w.state.status === 'busted' && w.state.catches === 3, `status ${w.state.status}`);
}

// 18. A maxed alarm starts the 45 s police countdown, and it busts you.
{
  const w = fresh();
  pinAllGuards(w);
  w.state.alarm = 100;
  stepN(w, 1);
  const policeAfter1 = w.state.police;
  const policeStarted = policeAfter1 > 44 && policeAfter1 <= 45 && !w.state.ghost;
  stepN(w, 3000); // 50 s
  check('police: maxed alarm starts a 45 s countdown to busted', policeStarted && w.state.status === 'busted', `police after 1 step ${policeAfter1.toFixed(2)}, status ${w.state.status}`);
}

// 19. The alarm decays while nobody sees you.
{
  const w = fresh();
  pinAllGuards(w);
  w.state.alarm = 50;
  stepN(w, 60); // 1 s
  check('alarm: decays 3/s while unseen', w.state.alarm < 50 && w.state.alarm > 40, `alarm ${w.state.alarm.toFixed(1)}`);
}

// 20. Running is loud: a guard in earshot investigates the noise.
{
  const w = fresh();
  const g = pinGuard(w, 0, 12.5 * TILE, 7.5 * TILE, 0); // facing east
  w.state.player.x = 11 * TILE; // behind him, out of the cone
  w.state.player.y = 7.5 * TILE;
  stepN(w, 10, { x: -1, y: 0, run: true, sneak: false, interact: false, smoke: false });
  check('noise: running attracts a nearby guard', g.state === 'suspect' && g.suspicion >= 30, `state ${g.state}, suspicion ${g.suspicion.toFixed(0)}`);
}

// 21. Drilling is loud: a guard in earshot investigates the drill.
{
  const w = fresh(0, ['drill']);
  const g = pinGuard(w, 0, 15.5 * TILE, 5.5 * TILE, Math.PI); // facing away from the vault
  pinGuard(w, 1, 1.5 * TILE, 13.5 * TILE, 0);
  w.state.player.x = 17.5 * TILE;
  w.state.player.y = 2.5 * TILE;
  stepN(w, 60, { ...idle, interact: true }); // 1 s of drilling
  check('noise: drilling attracts a nearby guard', g.state !== 'patrol' && g.suspicion >= 40, `state ${g.state}, suspicion ${g.suspicion.toFixed(0)}`);
}

// 22. Smoke bombs: two per job, each cloud lasts 8 s, no third bomb.
{
  const w = fresh(0, ['smoke']);
  w.step(STEP, { ...idle, smoke: true }, 0);
  const first = w.state.smokesLeft === 1 && w.state.smokes.length === 1;
  stepN(w, 540); // 9 s: the cloud is gone
  const expired = w.state.smokes.length === 0;
  w.step(STEP, { ...idle, smoke: true }, 0);
  const second = w.state.smokesLeft === 0 && w.state.smokes.length === 1;
  w.step(STEP, { ...idle, smoke: true }, 0);
  const noneLeft = w.state.smokes.length === 1 && w.state.smokesLeft === 0;
  check('tools: two smoke bombs per job, 8 s clouds', first && expired && second && noneLeft, `left ${w.state.smokesLeft}, clouds ${w.state.smokes.length}`);
}

// 23. Loot weight slows the thief: gold (weight 1) costs 15% speed.
{
  const light = fresh();
  stepN(light, 60, { x: 1, y: 0, run: false, sneak: false, interact: false, smoke: false });
  const distLight = light.state.player.x - 60;
  const heavy = fresh();
  heavy.state.player.carrying = [{ x: 0, y: 0, kind: 'gold', taken: true }];
  heavy.state.player.weight = 1;
  heavy.state.player.lootValue = 3000;
  stepN(heavy, 60, { x: 1, y: 0, run: false, sneak: false, interact: false, smoke: false });
  const distHeavy = heavy.state.player.x - 60;
  check('loot: gold weight slows the thief', distLight > 120 && distHeavy < distLight * 0.9, `light ${distLight.toFixed(0)} px, heavy ${distHeavy.toFixed(0)} px`);
}

// 24. End to end: the staged end scene clears job 1 with $6,000 of loot.
{
  const w = fresh(0, [...END_TOOLS]);
  const screen = applyShot(w, 'end', createRandom(7));
  check('end to end: staged run clears job 1 with $6,000', screen === SCREEN_CLEAR && w.state.status === 'clear' && w.state.player.lootValue === 6000 && w.state.score > 7000, `status ${w.state.status}, loot $${w.state.player.lootValue}, score ${w.state.score}`);
}

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('HEADLESS TEST FAILED');
  process.exit(1);
}
console.log('HEADLESS TEST PASSED 24/24');
