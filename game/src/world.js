// MIDNIGHT VAULT — pure game logic, no DOM, no canvas, no audio.
// Everything a headless test needs lives here: create a game, feed it
// inputs, and read the state back. The browser modules only render this
// state and translate keys into the input object update() expects.

import {
  TILE,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_RADIUS,
  WALK_SPEED,
  RUN_SPEED,
  SNEAK_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SUSPICIOUS_SPEED,
  GUARD_SIGHT_RANGE,
  GUARD_SIGHT_RANGE_DISGUISED,
  GUARD_HALF_ANGLE,
  GUARD_HEAR_RUN_RANGE,
  GUARD_HEAR_DRILL_RANGE,
  GUARD_CATCH_RANGE,
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  CAMERA_SWEEP,
  CAMERA_SWEEP_SPEED,
  CAMERA_DISABLE_SECONDS,
  ALARM_MAX,
  ALARM_GUARD_RATE,
  ALARM_CAMERA_RATE,
  ALARM_DECAY_RATE,
  POLICE_SECONDS,
  LOCKPICK_SECONDS,
  DOOR_SECONDS_NO_PICK,
  HACK_SECONDS,
  DRILL_SECONDS_WITH_RIG,
  DRILL_SECONDS_NO_RIG,
  INTERACT_RANGE,
  SMOKE_PER_JOB,
  SMOKE_RADIUS,
  SMOKE_SECONDS,
  MAX_CAUGHT,
  GHOST_BONUS,
  JOB_BONUS,
  JOB_PAR_SECONDS,
  LOOT_WEIGHT,
  LOOT_VALUE,
  JOBS,
  TOOLS,
} from './config.js';
import { mulberry32 } from './random.js';

export const TOOL_IDS = TOOLS.map((t) => t.id);

// ---------------------------------------------------------------- map parsing

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Parse one job's ASCII map into a playable job state. Rows are padded with
// wall so a ragged map still parses.
function parseJob(def, index, tools, rng) {
  const rows = def.map;
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((row) => {
    const chars = row.split('');
    while (chars.length < cols) chars.push('#');
    return chars;
  });
  const job = {
    index,
    name: def.name,
    quota: def.quota,
    cols,
    rows: rows.length,
    grid,
    spawn: { x: TILE + TILE / 2, y: TILE + TILE / 2 },
    van: null,
    loot: [],
    doors: [],
    terminals: [],
    vault: null,
    cameras: [],
    guards: [],
    smokes: [],
    alarm: 0,
    alarmEverFull: false,
    policeTimer: null,
    caught: 0,
    jobTime: 0,
    smokesLeft: SMOKE_PER_JOB,
    carried: [],
    vanHintUntil: 0,
    drilling: false,
    running: false,
    message: '',
    messageUntil: 0,
  };
  for (let ty = 0; ty < rows.length; ty++) {
    for (let tx = 0; tx < rows[ty].length; tx++) {
      const ch = rows[ty][tx];
      const c = tileCenter(tx, ty);
      if (ch === 'P') job.spawn = { x: c.x, y: c.y };
      else if (ch === 'E') job.van = { tx, ty, x: c.x, y: c.y };
      else if (ch === 'c' || ch === 'j' || ch === 'a') {
        const kind = ch === 'c' ? 'cash' : ch === 'j' ? 'jewels' : 'art';
        job.loot.push({ kind, value: LOOT_VALUE[kind], x: c.x, y: c.y, taken: false });
      } else if (ch === 'D') {
        job.doors.push({ tx, ty, x: c.x, y: c.y, open: false, progress: 0 });
      } else if (ch === 'T') {
        job.terminals.push({ tx, ty, x: c.x, y: c.y, progress: 0 });
      } else if (ch === 'V') {
        job.vault = { tx, ty, x: c.x, y: c.y, open: false, progress: 0 };
      } else if (ch === 'C') {
        const n = job.cameras.length;
        job.cameras.push({
          x: c.x,
          y: c.y,
          baseAngle: [0, Math.PI, Math.PI / 2, -Math.PI / 2][n % 4],
          phase: rng() * Math.PI * 2,
          angle: 0,
          disabledUntil: -1,
          seeing: false,
        });
      }
    }
  }
  for (const g of def.guards) {
    const start = tileCenter(g.x, g.y);
    const waypoints = g.waypoints.map(([wx, wy]) => tileCenter(wx, wy));
    const next = waypoints[1] ?? waypoints[0];
    job.guards.push({
      x: start.x,
      y: start.y,
      dir: Math.atan2(next.y - start.y, next.x - start.x),
      home: { x: start.x, y: start.y },
      waypoints,
      wp: 1,
      mode: 'patrol',
      alert: 0,
      loseTime: 0,
      lastSeen: null,
      heard: null,
      seeing: false,
    });
  }
  // The player's position on the job, so sight helpers work before the
  // first update tick as well.
  job.playerX = job.spawn.x;
  job.playerY = job.spawn.y;
  return job;
}

// The effective tile character at (tx, ty): open doors read as floor, an
// open vault reads as floor, everything else as drawn.
export function tileAt(job, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= job.cols || ty >= job.rows) return '#';
  const ch = job.grid[ty][tx];
  if (ch === 'D') {
    const door = job.doors.find((d) => d.tx === tx && d.ty === ty);
    return door && door.open ? '.' : 'D';
  }
  if (ch === 'V') return job.vault && job.vault.open ? '.' : 'V';
  return ch;
}

// Whether a tile blocks movement.
export function solidAt(job, tx, ty) {
  const ch = tileAt(job, tx, ty);
  return ch === '#' || ch === 'B' || ch === 'D' || ch === 'V' || ch === 'T';
}

// Whether a tile blocks a line of sight (low furniture does not).
function sightBlockingAt(job, tx, ty) {
  const ch = tileAt(job, tx, ty);
  return ch === '#' || ch === 'B' || ch === 'D' || ch === 'V';
}

// True when the segment between two points crosses no wall, crate, closed
// door or vault — and no smoke cloud.
export function lineOfSight(job, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (sightBlockingAt(job, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    for (const s of job.smokes) {
      if (Math.hypot(x - s.x, y - s.y) < s.r) return false;
    }
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---------------------------------------------------------------- game state

export function createGame(seed = 20261122) {
  return {
    seed,
    rng: mulberry32(seed),
    phase: 'plan',
    phaseBeforePause: null,
    tools: [],
    jobIndex: 0,
    job: null,
    player: { x: 0, y: 0, dir: 0, target: null },
    score: 0,
    totalLoot: 0,
    runCaught: 0,
    time: 0,
    lastClear: null,
    bustedReason: null,
    muted: false,
    _prev: { smoke: false, pause: false, enter: false },
  };
}

export function hasTool(state, toolId) {
  return state.tools.includes(toolId);
}

// Toggle a tool in the PLAN phase. At most two may be picked; picking a
// third is ignored.
export function toggleTool(state, toolId) {
  if (state.phase !== 'plan') return false;
  if (!TOOL_IDS.includes(toolId)) return false;
  const at = state.tools.indexOf(toolId);
  if (at >= 0) {
    state.tools.splice(at, 1);
    return true;
  }
  if (state.tools.length >= 2) return false;
  state.tools.push(toolId);
  return true;
}

export function startJob(state, index) {
  const def = JOBS[index];
  state.jobIndex = index;
  state.job = parseJob(def, index, state.tools, state.rng);
  state.player.x = state.job.spawn.x;
  state.player.y = state.job.spawn.y;
  state.player.dir = 0;
  state.player.target = null;
  state.phase = 'play';
}

export function beginRun(state) {
  if (state.tools.length !== 2) return false;
  startJob(state, 0);
  return true;
}

function resetRun(state) {
  state.phase = 'plan';
  state.tools = [];
  state.jobIndex = 0;
  state.job = null;
  state.score = 0;
  state.totalLoot = 0;
  state.runCaught = 0;
  state.time = 0;
  state.lastClear = null;
  state.bustedReason = null;
}

export function carriedValue(job) {
  return job.carried.reduce((n, item) => n + item.value, 0);
}

function carryWeight(job) {
  return job.carried.reduce((n, item) => n + LOOT_WEIGHT[item.kind], 0);
}

function setMessage(job, text) {
  job.message = text;
  job.messageUntil = job.jobTime + 2.5;
}

// ---------------------------------------------------------------- sight

export function guardCanSee(job, guard, tools) {
  const dx = job.playerX - guard.x;
  const dy = job.playerY - guard.y;
  const dist = Math.hypot(dx, dy);
  const range = tools.includes('disguise') ? GUARD_SIGHT_RANGE_DISGUISED : GUARD_SIGHT_RANGE;
  if (dist > range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), guard.dir)) > GUARD_HALF_ANGLE) return false;
  return lineOfSight(job, guard.x, guard.y, job.playerX, job.playerY);
}

export function cameraCanSee(job, camera) {
  if (job.jobTime < camera.disabledUntil) return false;
  const dx = job.playerX - camera.x;
  const dy = job.playerY - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA_RANGE) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), camera.angle)) > CAMERA_HALF_ANGLE) return false;
  return lineOfSight(job, camera.x, camera.y, job.playerX, job.playerY);
}

// ---------------------------------------------------------------- scoring

function clearJob(state) {
  const job = state.job;
  const loot = carriedValue(job);
  const jobBonus = JOB_BONUS[job.index];
  const timeBonus = Math.max(0, Math.round(JOB_PAR_SECONDS[job.index] - job.jobTime)) * 10;
  const ghostBonus = job.alarmEverFull ? 0 : GHOST_BONUS;
  const total = loot + jobBonus + timeBonus + ghostBonus;
  state.score += total;
  state.totalLoot += loot;
  state.lastClear = {
    job: job.index,
    name: job.name,
    loot,
    jobBonus,
    timeBonus,
    ghostBonus,
    total,
  };
  state.phase = job.index >= JOBS.length - 1 ? 'win' : 'jobClear';
}

function bustJob(state, reason) {
  state.bustedReason = reason;
  state.phase = 'busted';
}

function onCaught(state) {
  const job = state.job;
  job.caught += 1;
  state.runCaught += 1;
  // Lose half the carried loot: drop items from the top of the bag until
  // at least half the value is gone.
  const total = carriedValue(job);
  let toDrop = total / 2;
  while (toDrop > 0 && job.carried.length > 0) {
    const item = job.carried.pop();
    toDrop -= item.value;
  }
  state.player.x = job.spawn.x;
  state.player.y = job.spawn.y;
  state.player.target = null;
  job.alarm = 0;
  job.policeTimer = null;
  job.smokes = [];
  for (const g of job.guards) {
    g.x = g.home.x;
    g.y = g.home.y;
    g.wp = 1;
    g.mode = 'patrol';
    g.alert = 0;
    g.loseTime = 0;
    g.lastSeen = null;
    g.heard = null;
  }
  if (job.caught >= MAX_CAUGHT) {
    bustJob(state, 'caught');
  } else {
    setMessage(job, `Caught! Lost half the loot. (${job.caught}/${MAX_CAUGHT})`);
  }
}

// ---------------------------------------------------------------- movement

function circleHitsSolid(job, x, y) {
  const r = PLAYER_RADIUS;
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(job, tx, ty)) {
        // Closest point of the tile to the circle centre.
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if (Math.hypot(x - cx, y - cy) < r) return true;
      }
    }
  }
  return false;
}

function moveCircle(job, pos, dx, dy) {
  if (dx !== 0 && !circleHitsSolid(job, pos.x + dx, pos.y)) pos.x += dx;
  if (dy !== 0 && !circleHitsSolid(job, pos.x, pos.y + dy)) pos.y += dy;
}

// ---------------------------------------------------------------- update

export function update(state, input = {}, dt = 1 / 60) {
  const prev = state._prev;
  const pausePressed = !!input.pause && !prev.pause;
  const enterPressed = !!input.enter && !prev.enter;
  const smokePressed = !!input.smoke && !prev.smoke;
  prev.pause = !!input.pause;
  prev.enter = !!input.enter;
  prev.smoke = !!input.smoke;

  if (pausePressed && (state.phase === 'play' || state.phase === 'paused')) {
    if (state.phase === 'play') {
      state.phaseBeforePause = 'play';
      state.phase = 'paused';
    } else {
      state.phase = state.phaseBeforePause ?? 'play';
      state.phaseBeforePause = null;
    }
    return;
  }

  if (state.phase === 'plan') {
    if (enterPressed) beginRun(state);
    return;
  }
  if (state.phase === 'jobClear') {
    if (enterPressed) startJob(state, state.jobIndex + 1);
    return;
  }
  if (state.phase === 'win' || state.phase === 'busted') {
    if (enterPressed) resetRun(state);
    return;
  }
  if (state.phase !== 'play' || !state.job) return;

  const job = state.job;
  const player = state.player;
  job.jobTime += dt;
  state.time += dt;
  // Keep the player's position on the job too, so sight helpers read it.
  job.playerX = player.x;
  job.playerY = player.y;

  // --- smoke bomb (edge triggered) ---
  if (smokePressed) {
    if (hasTool(state, 'smoke') && job.smokesLeft > 0) {
      job.smokes.push({ x: player.x, y: player.y, r: SMOKE_RADIUS, t: SMOKE_SECONDS });
      job.smokesLeft -= 1;
    } else if (hasTool(state, 'smoke')) {
      setMessage(job, 'Out of smoke bombs.');
    }
  }
  for (const s of job.smokes) s.t -= dt;
  job.smokes = job.smokes.filter((s) => s.t > 0);

  // --- movement ---
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx === 0 && my === 0 && player.target) {
    const dx = player.target.x - player.x;
    const dy = player.target.y - player.y;
    if (Math.hypot(dx, dy) < 6) {
      player.target = null;
    } else {
      mx = dx / Math.hypot(dx, dy);
      my = dy / Math.hypot(dx, dy);
    }
  }
  const moving = mx !== 0 || my !== 0;
  const weight = carryWeight(job);
  const speedFactor = 1 / (1 + 0.07 * weight);
  let speed = WALK_SPEED * speedFactor;
  if (input.run) speed = RUN_SPEED * speedFactor;
  if (input.sneak) speed = SNEAK_SPEED * speedFactor;
  job.running = moving && !!input.run && !input.sneak;
  if (moving) {
    const len = Math.hypot(mx, my) || 1;
    const step = speed * dt;
    moveCircle(job, player, (mx / len) * step, (my / len) * step);
    player.dir = Math.atan2(my / len, mx / len);
  }
  job.playerX = player.x;
  job.playerY = player.y;

  // --- interaction: hold E near a door, terminal or vault ---
  let target = null;
  let targetKind = null;
  let targetNeed = 0;
  const near = (x, y) => Math.hypot(player.x - x, player.y - y) <= INTERACT_RANGE;
  let best = Infinity;
  for (const door of job.doors) {
    if (door.open) continue;
    const d = Math.hypot(player.x - door.x, player.y - door.y);
    if (d < best && near(door.x, door.y)) {
      best = d;
      target = door;
      targetKind = 'door';
      targetNeed = hasTool(state, 'lockpick') ? LOCKPICK_SECONDS : DOOR_SECONDS_NO_PICK;
    }
  }
  for (const term of job.terminals) {
    const d = Math.hypot(player.x - term.x, player.y - term.y);
    if (d < best && near(term.x, term.y)) {
      best = d;
      target = term;
      targetKind = 'terminal';
      targetNeed = HACK_SECONDS;
    }
  }
  if (job.vault && !job.vault.open) {
    const d = Math.hypot(player.x - job.vault.x, player.y - job.vault.y);
    if (d < best && near(job.vault.x, job.vault.y)) {
      best = d;
      target = job.vault;
      targetKind = 'vault';
      targetNeed = hasTool(state, 'drill') ? DRILL_SECONDS_WITH_RIG : DRILL_SECONDS_NO_RIG;
    }
  }
  job.drilling = false;
  const interactables = [
    ...job.doors.filter((d) => !d.open),
    ...job.terminals,
    ...(job.vault && !job.vault.open ? [job.vault] : []),
  ];
  for (const it of interactables) {
    if (it !== target) it.progress = Math.max(0, it.progress - dt * 2);
  }
  if (target && input.interact) {
    target.progress += dt;
    if (targetKind === 'vault') job.drilling = true;
    if (target.progress >= targetNeed) {
      if (targetKind === 'door') {
        target.open = true;
        setMessage(job, 'Door picked.');
      } else if (targetKind === 'terminal') {
        target.progress = 0;
        for (const cam of job.cameras) cam.disabledUntil = job.jobTime + CAMERA_DISABLE_SECONDS;
        setMessage(job, `Cameras down for ${CAMERA_DISABLE_SECONDS}s.`);
      } else if (targetKind === 'vault') {
        target.open = true;
        target.progress = 0;
        job.loot.push({
          kind: 'gold',
          value: LOOT_VALUE.gold,
          x: target.x,
          y: target.y,
          taken: false,
        });
        setMessage(job, 'Vault open — gold bars!');
      }
    }
  }

  // --- loot pickup ---
  for (const loot of job.loot) {
    if (!loot.taken && Math.hypot(player.x - loot.x, player.y - loot.y) < 22) {
      loot.taken = true;
      job.carried.push({ kind: loot.kind, value: loot.value });
    }
  }

  // --- guards ---
  let anyGuardSeeing = false;
  for (const guard of job.guards) {
    const seeing = guardCanSee(job, guard, state.tools);
    guard.seeing = seeing;
    if (seeing) {
      anyGuardSeeing = true;
      guard.loseTime = 0;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.heard = null;
      guard.alert = Math.min(1, guard.alert + dt * 0.9);
    } else {
      guard.loseTime += dt;
      guard.alert = Math.max(0, guard.alert - dt * 0.35);
    }
    // Hearing: running feet, or the drill.
    const dPlayer = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (job.running && moving && dPlayer < GUARD_HEAR_RUN_RANGE) {
      guard.heard = { x: player.x, y: player.y };
      guard.alert = Math.max(guard.alert, 0.35);
    }
    if (job.drilling && job.vault) {
      const dVault = Math.hypot(job.vault.x - guard.x, job.vault.y - guard.y);
      if (dVault < GUARD_HEAR_DRILL_RANGE) {
        guard.heard = { x: job.vault.x, y: job.vault.y };
        guard.alert = Math.max(guard.alert, 0.35);
      }
    }
    // Mode from alert, with hysteresis so a guard does not flicker.
    if (guard.alert >= 1) guard.mode = 'chase';
    else if (guard.mode === 'chase' && guard.alert < 0.5) guard.mode = 'suspicious';
    else if (guard.mode !== 'chase' && guard.alert >= 0.35) guard.mode = 'suspicious';
    else if (guard.alert < 0.2) guard.mode = 'patrol';

    if (guard.mode === 'patrol') {
      const wp = guard.waypoints[guard.wp];
      const dx = wp.x - guard.x;
      const dy = wp.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
      } else {
        const step = GUARD_PATROL_SPEED * dt;
        guard.dir = Math.atan2(dy, dx);
        moveCircle(job, guard, (dx / dist) * step, (dy / dist) * step);
      }
    } else if (guard.mode === 'suspicious') {
      const goal = guard.lastSeen ?? guard.heard;
      if (goal && !seeing) {
        const dx = goal.x - guard.x;
        const dy = goal.y - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          const step = GUARD_SUSPICIOUS_SPEED * dt;
          guard.dir = Math.atan2(dy, dx);
          moveCircle(job, guard, (dx / dist) * step, (dy / dist) * step);
        }
      } else if (guard.lastSeen) {
        guard.dir = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      }
    } else if (guard.mode === 'chase') {
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const step = GUARD_CHASE_SPEED * dt;
        guard.dir = Math.atan2(dy, dx);
        moveCircle(job, guard, (dx / dist) * step, (dy / dist) * step);
      }
      if (dist < GUARD_CATCH_RANGE) {
        onCaught(state);
        return;
      }
    }
  }

  // --- cameras ---
  let anyCameraSeeing = false;
  for (const cam of job.cameras) {
    cam.angle = cam.baseAngle + Math.sin(job.jobTime * CAMERA_SWEEP_SPEED + cam.phase) * CAMERA_SWEEP;
    cam.seeing = cameraCanSee(job, cam);
    if (cam.seeing) anyCameraSeeing = true;
  }

  // --- alarm ---
  if (anyGuardSeeing) job.alarm += ALARM_GUARD_RATE * dt;
  if (anyCameraSeeing) job.alarm += ALARM_CAMERA_RATE * dt;
  if (!anyGuardSeeing && !anyCameraSeeing && job.policeTimer === null) {
    job.alarm = Math.max(0, job.alarm - ALARM_DECAY_RATE * dt);
  }
  if (job.alarm >= ALARM_MAX) {
    job.alarm = ALARM_MAX;
    job.alarmEverFull = true;
    if (job.policeTimer === null) {
      job.policeTimer = POLICE_SECONDS;
      setMessage(job, `ALARM! Police in ${POLICE_SECONDS}s — get to the van!`);
    }
  }
  if (job.policeTimer !== null) {
    job.policeTimer -= dt;
    if (job.policeTimer <= 0) {
      job.policeTimer = 0;
      bustJob(state, 'police');
      return;
    }
  }

  // --- getaway van ---
  if (job.van && Math.hypot(player.x - job.van.x, player.y - job.van.y) < 26) {
    if (carriedValue(job) >= job.quota) {
      clearJob(state);
      return;
    }
    if (job.jobTime > job.vanHintUntil) {
      setMessage(job, `Need $${job.quota - carriedValue(job)} more loot for this job.`);
      job.vanHintUntil = job.jobTime + 2.5;
    }
  }
}

// ---------------------------------------------------------------- snapshot

// A plain, rounded view of the state for tests and determinism checks.
export function snapshot(state) {
  const job = state.job;
  const round3 = (n) => Math.round(n * 1000) / 1000;
  return {
    phase: state.phase,
    jobIndex: state.jobIndex,
    score: state.score,
    totalLoot: state.totalLoot,
    tools: [...state.tools].sort(),
    player: job
      ? { x: round3(state.player.x), y: round3(state.player.y) }
      : null,
    carriedValue: job ? carriedValue(job) : 0,
    carried: job ? job.carried.map((c) => c.kind) : [],
    alarm: job ? round3(job.alarm) : 0,
    policeTimer: job && job.policeTimer !== null ? round3(job.policeTimer) : null,
    caught: job ? job.caught : 0,
    vaultOpen: job && job.vault ? job.vault.open : false,
    doorsOpen: job ? job.doors.filter((d) => d.open).length : 0,
    lootTaken: job ? job.loot.filter((l) => l.taken).length : 0,
    smokesLeft: job ? job.smokesLeft : 0,
    guards: job
      ? job.guards.map((g) => ({
          x: round3(g.x),
          y: round3(g.y),
          mode: g.mode,
          alert: round3(g.alert),
        }))
      : [],
    camerasDisabled: job
      ? job.cameras.filter((c) => job.jobTime < c.disabledUntil).length
      : 0,
  };
}

export { MAP_COLS, MAP_ROWS };
