// Screenshot scenes behind ?shot=play|plan|alert|end. Each one plays the real
// rules forward from a fresh world, steered by a waypoint autopilot that
// freezes and sneaks whenever a guard starts to suspect it, so the frame is
// what a careful run really looks like — and the same seed always gives the
// same frame. The play scene is the cover: it is staged so one frame holds
// the whole heist — the thief, a guard cone, a camera cone, loot, and the
// alarm meter. Waypoints stay on open lanes (axis-aligned legs only): a
// straight line that cuts a wall corner stalls the autopilot.
import { STEP, TILE } from './config.js';
import { EVENT_CLEAR, EVENT_BUSTED, EVENT_CAUGHT } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_BUSTED } from './render.js';

const SAMPLE = STEP;

// Tools the staged runs carry: lockpicks + drill rig (the vault matters).
const TOOLS = ['lockpicks', 'drill'];
// The end run swaps lockpicks for smoke: job 1 has no locked door, and the
// smoke lets the thief drill the vault while a guard investigates the noise.
const END_TOOLS = ['smoke', 'drill'];

function tile(x, y) {
  return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
}

/** Follow `waypoints` (tile coords) at fixed steps; freeze when a guard suspects. */
function runWaypoints(world, waypoints, maxSeconds, stopWhen, bold = false, sneakIdle = true) {
  let index = 0;
  let stuckTimer = 0;
  let lastX = world.state.player.x;
  let lastY = world.state.player.y;
  const steps = Math.floor(maxSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const s = world.state;
    const maxSuspicion = Math.max(0, ...s.guards.map((g) => g.suspicion));
    const anyAlert = s.guards.some((g) => g.state === 'alert');
    let input = { x: 0, y: 0, run: false, sneak: false, interact: false, smoke: false };
    if (index >= waypoints.length) {
      // Waypoints done: if nothing is being waited for, stop here — idling
      // in a camera cone for the rest of the cap is how runs get busted.
      if (!stopWhen) break;
      input = { x: 0, y: 0, run: false, sneak: sneakIdle, interact: false, smoke: false };
    } else if (!bold && maxSuspicion >= 38 && !anyAlert) {
      // A guard is getting suspicious: freeze and sneak until he calms down.
      input = { x: 0, y: 0, run: false, sneak: true, interact: false, smoke: false };
    } else {
      const [tx, ty] = waypoints[index];
      const w = tile(tx, ty);
      const dx = w.x - s.player.x;
      const dy = w.y - s.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        index += 1;
      } else {
        // A guard in full chase: run for the waypoint instead of freezing.
        input = { x: dx / d, y: dy / d, run: anyAlert, sneak: false, interact: false, smoke: false };
      }
    }
    const events = world.step(SAMPLE, input, 0);
    if (stopWhen && stopWhen(world, events)) break;
    if (events & (EVENT_CLEAR | EVENT_BUSTED | EVENT_CAUGHT)) break;
    if (Math.hypot(s.player.x - lastX, s.player.y - lastY) < 0.5) {
      stuckTimer += SAMPLE;
      if (stuckTimer > 2 && index < waypoints.length) {
        index += 1;
        stuckTimer = 0;
      }
    } else {
      stuckTimer = 0;
    }
    lastX = s.player.x;
    lastY = s.player.y;
  }
}

// Advance the world with no input until the guards' cones read longest.
function bestConeMoment(world, maxSeconds) {
  const steps = Math.floor(maxSeconds / SAMPLE);
  let best = -1;
  let bestStep = 0;
  for (let i = 0; i < steps; i += 1) {
    const s = world.state;
    let score = 0;
    for (const g of s.guards) score += world.coneReach(g.x, g.y, g.angle, 0.58, 195);
    for (const c of s.cameras) score += world.coneReach(c.x, c.y, c.angle, 0.5, 175) * 0.8;
    if (score > best) { best = score; bestStep = i; }
    world.step(SAMPLE, { x: 0, y: 0, run: false, sneak: true, interact: false, smoke: false }, 0);
    if (s.status !== 'play') break;
  }
  return bestStep;
}

export function applyShot(world, shot, rng) {
  const s = world.state;
  if (shot === 'plan') return SCREEN_PLAY; // plan is drawn by main.js without a world
  if (shot === 'play') {
    // Job 1: down the left side for the cash at (3,13), back up the middle,
    // around the teller block via row 12 to the jewels at (17,10), then wait
    // where a guard cone and a camera cone both sweep past.
    runWaypoints(world, [[1, 3], [1, 6], [1, 10], [3, 13], [5, 12], [7, 10], [10, 10], [10, 12], [17, 12], [17, 10]], 60);
    bestConeMoment(world, 12);
    return SCREEN_PLAY;
  }
  if (shot === 'alert') {
    // Walk to (11,4) — dead centre of camera 1's sweep under the vault —
    // and stand there until the alarm is well up: the frame shows the red
    // camera cone on the thief and the alarm bar climbing.
    runWaypoints(
      world,
      [[1, 3], [1, 6], [7, 6], [7, 3], [10, 3], [11, 3], [11, 4]],
      30,
      (w) => w.state.alarm >= 55,
      true,
      false,
    );
    return SCREEN_PLAY;
  }
  if (shot === 'end') {
    // The full job 1: cash (3,13), jewels (17,10), cash (20,7), cash (20,1),
    // drill the vault for the gold, then reach the van with $5,500.
    runWaypoints(world, [[1, 3], [1, 6], [1, 10], [3, 13], [5, 12], [7, 10], [10, 10], [10, 12], [17, 12], [17, 10]], 60);
    runWaypoints(world, [[17, 12], [20, 12], [20, 10], [20, 7]], 40);
    runWaypoints(world, [[20, 4], [20, 2], [20, 1]], 40);
    // To the vault down column 17 — never on a guard patrol lane.
    runWaypoints(world, [[20, 4], [17, 4], [17, 2]], 20);
    // Drill the vault from (17,2), inside a smoke cloud so the guard the
    // drill noise attracts cannot see the thief. The drill stand is the
    // floor tile below the vault, not the vault's own centre: that point
    // sits inside the wall and the thief can never reach it.
    const vaultX = (s.vault.x + 0.5) * TILE;
    const vaultY = (s.vault.y + 1.5) * TILE;
    let drilled = false;
    let smoked = false;
    for (let i = 0; i < Math.floor(30 / SAMPLE); i += 1) {
      const dx = vaultX - s.player.x, dy = vaultY - s.player.y;
      const d = Math.hypot(dx, dy);
      let input;
      if (d > 12) {
        input = { x: dx / d, y: dy / d, run: false, sneak: false, interact: false, smoke: false };
      } else {
        input = { x: 0, y: 0, run: false, sneak: true, interact: true, smoke: !smoked };
        smoked = true;
      }
      const events = world.step(SAMPLE, input, 0);
      if (s.vault.open) { drilled = true; break; }
      if (events & (EVENT_CLEAR | EVENT_BUSTED | EVENT_CAUGHT)) break;
    }
    if (drilled) {
      // Pick up the gold that slid out, then drive to the van.
      runWaypoints(world, [[17, 2], [17, 4], [17, 6], [18, 8], [19, 10], [20, 12]], 60);
    }
    return s.status === 'clear' ? SCREEN_CLEAR : SCREEN_PLAY;
  }
  return SCREEN_PLAY;
}

export { TOOLS, END_TOOLS };
