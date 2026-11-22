// MIDNIGHT VAULT — pure heist logic, no DOM. A world is one job: the thief,
// the guards and their vision cones, the rotating security cameras, the
// loot, the vault, the terminal and the getaway van. Everything the render
// and the screenshots need is on `state`.
import {
  STEP, TILE, COLS, ROWS, JOBS, LOOT,
  PLAYER_SPEED, RUN_SPEED, SNEAK_SPEED, GUARD_SPEED, GUARD_CHASE_SPEED,
  CONE_RANGE, CONE_HALF, CAMERA_RANGE, CAMERA_HALF, DETECT_GAIN, SUSPECT_AT,
  ALARM_MAX, ALARM_DECAY, CAMERA_ALARM_RATE, POLICE_SECONDS,
  NOISE_RUN_RADIUS, NOISE_DRILL_RADIUS, SMOKE_SECONDS, SMOKE_RADIUS,
  CAMERA_OFF_SECONDS,
} from './config.js';

export const EVENT_CLEAR = 1; // reached the van with the quota
export const EVENT_BUSTED = 2; // police timer ran out (or caught 3 times)
export const EVENT_CAUGHT = 4; // a guard tackled you: half the loot gone
export const EVENT_WIN = 8; // all three jobs cleared

const RAYS = 26;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(rng, jobIndex, tools) {
  const job = JOBS[jobIndex];
  const grid = job.map.map((row) => [...row]);
  const has = (id) => tools.includes(id);
  const tileAt = (tx, ty) => (grid[ty] && grid[ty][tx]) || '#';
  const solidCh = (ch) => ch === '#' || ch === 'C' || ch === 'V' || ch === 'M';
  const isSolidPx = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const ch = tileAt(tx, ty);
    if (ch === 'D') return !doors.some((d) => d.tx === tx && d.ty === ty && d.open);
    return solidCh(ch);
  };

  // --- parse the map -------------------------------------------------------
  let start = { x: 60, y: 60 };
  let van = { x: 0, y: 0 };
  const guards = [];
  const doors = [];
  const loot = [];
  let terminal = null;
  const cameras = job.cameras.map((c) => ({
    ...c, x: (c.tx + 0.5) * TILE, y: (c.ty + 0.5) * TILE, angle: c.base, sees: false,
  }));
  const vault = { ...job.vault, open: false, progress: 0 };
  grid.forEach((row, y) => row.forEach((ch, x) => {
    const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
    if (ch === 'P') start = { x: cx, y: cy };
    else if (ch === 'E') van = { x: cx, y: cy };
    else if (ch === 'G') guards.push({ x: cx, y: cy, patrol: null, waypoint: 0, angle: 0, state: 'patrol', suspicion: 0, pause: 0, scanBase: 0, scanDir: 1, investigate: null, searchT: 0, lastSeen: null });
    else if (ch === 'D') doors.push({ tx: x, ty: y, open: false, progress: 0 });
    else if (ch === 'T') terminal = { tx: x, ty: y, x: cx, y: cy, progress: 0, used: false };
  }));
  guards.forEach((g, i) => {
    g.patrol = job.patrols[i].map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }));
  });
  // Loot spots scan row-major; the job's loot list gives each spot its kind.
  let li = 0;
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === 'L') loot.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, kind: job.loot[li++], taken: false });
  }));

  const state = {
    jobIndex, job, tools,
    status: 'play',
    player: { x: start.x, y: start.y, angle: 0, carrying: [], lootValue: 0, weight: 0 },
    guards, cameras, doors, loot, terminal, vault, van,
    alarm: 0, police: -1, policeMax: POLICE_SECONDS,
    camerasOff: 0, smokes: [], smokesLeft: has('smoke') ? 2 : 0,
    catches: 0, time: 0, score: 0, ghost: true, cleared: false,
    start, drillNoise: 0, runNoise: 0,
  };

  function inSmoke(x, y) {
    return state.smokes.some((s) => Math.hypot(x - s.x, y - s.y) < SMOKE_RADIUS);
  }

  // Line of sight: true when nothing solid and no smoke sits between a and b.
  // Samples inside the source tile never block: a camera mounted in a wall
  // tile would otherwise be blind to its own room.
  function hasLOS(ax, ay, bx, by) {
    const stx = Math.floor(ax / TILE), sty = Math.floor(ay / TILE);
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(dist / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (Math.floor(x / TILE) === stx && Math.floor(y / TILE) === sty) continue;
      if (isSolidPx(x, y)) return false;
      if (inSmoke(x, y)) return false;
    }
    return true;
  }

  // One ray of a vision cone, clipped by walls and crates.
  function coneRay(x, y, angle, range) {
    const step = 6;
    const stx = Math.floor(x / TILE), sty = Math.floor(y / TILE);
    let d = 0;
    for (d = step; d <= range; d += step) {
      const px = x + Math.cos(angle) * d, py = y + Math.sin(angle) * d;
      if (Math.floor(px / TILE) === stx && Math.floor(py / TILE) === sty) continue;
      if (isSolidPx(px, py)) break;
    }
    return { x: x + Math.cos(angle) * Math.min(d, range), y: y + Math.sin(angle) * Math.min(d, range) };
  }

  // The clipped vision-cone polygon (for the renderer, and for screenshots).
  function conePolygon(x, y, angle, half, range) {
    const pts = [{ x, y }];
    for (let i = 0; i <= RAYS; i++) {
      const a = angle - half + (2 * half * i) / RAYS;
      pts.push(coneRay(x, y, a, range));
    }
    return pts;
  }
  function coneReach(x, y, angle, half, range) {
    return conePolygon(x, y, angle, half, range).reduce((m, p) => Math.max(m, Math.hypot(p.x - x, p.y - y)), 0);
  }

  function moveCircle(e, dx, dy, r) {
    const nx = e.x + dx;
    if (!isSolidPx(nx + Math.sign(dx) * r, e.y - r * 0.7) && !isSolidPx(nx + Math.sign(dx) * r, e.y + r * 0.7)) e.x = nx;
    const ny = e.y + dy;
    if (!isSolidPx(e.x - r * 0.7, ny + Math.sign(dy) * r) && !isSolidPx(e.x + r * 0.7, ny + Math.sign(dy) * r)) e.y = ny;
  }

  function hearNoise(x, y, radius) {
    for (const g of guards) {
      if (g.state === 'alert') continue;
      if (Math.hypot(g.x - x, g.y - y) < radius) {
        g.state = 'suspect';
        g.investigate = { x, y };
        g.suspicion = Math.max(g.suspicion, 40);
      }
    }
  }

  function dropHalfLoot() {
    const p = state.player;
    if (p.carrying.length === 0) return;
    const dropCount = Math.max(1, Math.floor(p.carrying.length / 2));
    // Drop the most valuable first — getting caught hurts.
    const sorted = [...p.carrying].sort((a, b) => LOOT[b.kind].value - LOOT[a.kind].value);
    const dropped = sorted.slice(0, dropCount);
    p.carrying = sorted.slice(dropCount);
    p.lootValue = p.carrying.reduce((s, l) => s + LOOT[l.kind].value, 0);
    p.weight = p.carrying.reduce((s, l) => s + LOOT[l.kind].weight, 0);
    for (const l of dropped) {
      // The dropped loot scatters back onto the floor where you were caught.
      state.loot.push({ x: p.x + (rng() - 0.5) * 60, y: p.y + (rng() - 0.5) * 60, kind: l.kind, taken: false });
    }
  }

  function stepGuard(g, dt, input) {
    const p = state.player;
    const range = has('disguise') ? 110 : CONE_RANGE;
    const distP = Math.hypot(p.x - g.x, p.y - g.y);
    let sees = false;
    if (distP < range && !inSmoke(p.x, p.y)) {
      const want = Math.atan2(p.y - g.y, p.x - g.x);
      if (Math.abs(angDiff(want, g.angle)) < CONE_HALF && hasLOS(g.x, g.y, p.x, p.y)) sees = true;
    }
    if (sees) {
      const closeness = 1 - distP / range;
      const centrality = 1 - Math.abs(angDiff(Math.atan2(p.y - g.y, p.x - g.x), g.angle)) / CONE_HALF;
      let rate = DETECT_GAIN * (0.35 + 0.65 * closeness) * (0.5 + 0.5 * centrality);
      if (tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === 'B') rate *= 0.3;
      if (input.sneak) rate *= 0.5;
      if (input.run) rate *= 1.25;
      g.suspicion = Math.min(100, g.suspicion + rate * dt);
      g.lastSeen = { x: p.x, y: p.y };
    } else {
      g.suspicion = Math.max(0, g.suspicion - 26 * dt);
    }

    if (g.suspicion >= 100 && g.state !== 'alert') {
      g.state = 'alert';
      if (state.alarm < ALARM_MAX) state.alarm = Math.min(ALARM_MAX, state.alarm + 25);
    } else if (g.suspicion >= SUSPECT_AT && g.state === 'patrol') {
      g.state = 'suspect';
      g.investigate = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
      g.scanBase = g.angle;
    }

    const wantAngle = (tx, ty) => Math.atan2(ty - g.y, tx - g.x);
    const turnTo = (want, maxTurn) => {
      const d = angDiff(want, g.angle);
      g.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
    };

    if (g.state === 'alert') {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < 26) return 'caught';
      turnTo(wantAngle(p.x, p.y), 6 * dt);
      moveCircle(g, Math.cos(g.angle) * GUARD_CHASE_SPEED * dt, Math.sin(g.angle) * GUARD_CHASE_SPEED * dt, 13);
      if (!sees && g.suspicion < 30) { g.state = 'search'; g.searchT = 3; }
    } else if (g.state === 'suspect') {
      const target = g.investigate || g.lastSeen || { x: g.patrol[g.waypoint].x, y: g.patrol[g.waypoint].y };
      const d = Math.hypot(target.x - g.x, target.y - g.y);
      if (d < 10) {
        // Arrived: scan the room for a while, then give up.
        g.scanBase = g.angle;
        g.angle += g.scanDir * 1.8 * dt;
        if (Math.abs(angDiff(g.angle, g.scanBase)) > 0.9) g.scanDir *= -1;
        g.searchT = (g.searchT || 0) + dt;
        if (g.searchT > 2.5) { g.state = 'patrol'; g.searchT = 0; g.suspicion = Math.max(0, g.suspicion - 20); }
      } else {
        turnTo(wantAngle(target.x, target.y), 5 * dt);
        moveCircle(g, Math.cos(g.angle) * GUARD_SPEED * 1.5 * dt, Math.sin(g.angle) * GUARD_SPEED * 1.5 * dt, 13);
        g.searchT = 0;
      }
      if (g.suspicion < 10 && !sees) { g.state = 'patrol'; }
    } else if (g.state === 'search') {
      g.angle += 2.2 * dt;
      g.searchT -= dt;
      if (g.searchT <= 0) { g.state = 'patrol'; g.suspicion = 0; }
    } else {
      // Patrol: walk the waypoints, pausing and looking around at each one.
      const target = g.patrol[g.waypoint];
      const d = Math.hypot(target.x - g.x, target.y - g.y);
      if (d < 6) {
        g.waypoint = (g.waypoint + 1) % g.patrol.length;
        g.pause = 1.2;
        g.scanBase = g.angle;
      } else if (g.pause > 0) {
        g.pause -= dt;
        g.angle += Math.sin(state.time * 2 + g.x) * 0.4 * dt;
      } else {
        turnTo(wantAngle(target.x, target.y), 4.5 * dt);
        moveCircle(g, Math.cos(g.angle) * GUARD_SPEED * dt, Math.sin(g.angle) * GUARD_SPEED * dt, 13);
      }
    }
    return null;
  }

  function step(dt, input, now) {
    if (state.status !== 'play') return 0;
    state.time += dt;
    const p = state.player;
    let events = 0;

    // --- the thief moves ----------------------------------------------------
    const weightFactor = Math.max(0.55, 1 - 0.15 * p.weight);
    const speed = (input.run ? RUN_SPEED : input.sneak ? SNEAK_SPEED : PLAYER_SPEED) * weightFactor;
    const len = Math.hypot(input.x, input.y);
    if (len > 0.01) {
      const dx = (input.x / len) * speed * dt, dy = (input.y / len) * speed * dt;
      moveCircle(p, dx, dy, 13);
      p.angle = Math.atan2(input.y, input.x);
    }
    // Running is loud.
    if (input.run && len > 0.01) {
      state.runNoise -= dt;
      if (state.runNoise <= 0) { hearNoise(p.x, p.y, NOISE_RUN_RADIUS); state.runNoise = 0.35; }
    }
    // Smoke bomb.
    if (input.smoke && state.smokesLeft > 0) {
      state.smokes.push({ x: p.x, y: p.y, t: SMOKE_SECONDS });
      state.smokesLeft -= 1;
    }
    for (const s of state.smokes) s.t -= dt;
    state.smokes = state.smokes.filter((s) => s.t > 0);

    // --- loot pickup ---------------------------------------------------------
    for (const l of state.loot) {
      if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 24) {
        l.taken = true;
        p.carrying.push(l);
        p.lootValue += LOOT[l.kind].value;
        p.weight += LOOT[l.kind].weight;
        state.score += LOOT[l.kind].value;
      }
    }

    // --- hold-E interactions: doors, terminal, vault -------------------------
    const near = (tx, ty, r) => Math.hypot((tx + 0.5) * TILE - p.x, (ty + 0.5) * TILE - p.y) < r;
    if (input.interact) {
      for (const d of doors) {
        if (!d.open && near(d.tx, d.ty, 46)) {
          d.progress += dt * (has('lockpicks') ? 2 : 1 / 3);
          if (d.progress >= 1) d.open = true;
        }
      }
      if (terminal && !terminal.used && near(terminal.tx, terminal.ty, 52)) {
        terminal.progress += dt / 2;
        if (terminal.progress >= 1) { terminal.used = true; state.camerasOff = CAMERA_OFF_SECONDS; }
      }
      if (!vault.open) {
        const vx = (vault.x + vault.w / 2) * TILE, vy = (vault.y + vault.h / 2) * TILE;
        if (Math.hypot(vx - p.x, vy - p.y) < 78) {
          vault.progress += dt * (has('drill') ? 0.25 : 1 / 12);
          state.drillNoise -= dt;
          if (state.drillNoise <= 0) { hearNoise(p.x, p.y, NOISE_DRILL_RADIUS); state.drillNoise = 0.5; }
          if (vault.progress >= 1) {
            vault.open = true;
            // The gold slides out onto the floor in front of the vault.
            const gy = (vault.y + 1.5) * TILE;
            state.loot.push({ x: vx, y: gy, kind: job.vaultLoot, taken: false });
          }
        }
      }
    }

    // --- cameras ---------------------------------------------------------------
    if (state.camerasOff > 0) state.camerasOff -= dt;
    let cameraSees = false;
    for (const c of cameras) {
      c.angle = c.base + Math.sin(state.time * c.speed) * c.sweep;
      c.sees = false;
      if (state.camerasOff > 0) continue;
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (dist < CAMERA_RANGE && !inSmoke(p.x, p.y)) {
        const want = Math.atan2(p.y - c.y, p.x - c.x);
        if (Math.abs(angDiff(want, c.angle)) < CAMERA_HALF && hasLOS(c.x, c.y, p.x, p.y)) {
          c.sees = true;
          cameraSees = true;
          state.alarm = Math.min(ALARM_MAX, state.alarm + CAMERA_ALARM_RATE * dt);
        }
      }
    }

    // --- guards ------------------------------------------------------------------
    for (const g of guards) {
      if (stepGuard(g, dt, input) === 'caught') {
        state.catches += 1;
        dropHalfLoot();
        p.x = state.start.x; p.y = state.start.y;
        state.alarm = Math.max(state.alarm, 60);
        state.ghost = false;
        for (const gg of guards) { gg.state = 'patrol'; gg.suspicion = 0; gg.investigate = null; }
        events |= EVENT_CAUGHT;
        if (state.catches >= 3) {
          state.status = 'busted';
          events |= EVENT_BUSTED;
          return events;
        }
      }
    }

    // --- the alarm and the police --------------------------------------------------
    const anyAlert = guards.some((g) => g.state === 'alert');
    if (state.alarm >= ALARM_MAX && state.police < 0) {
      // The alarm latches: once the police are called, there is no cooling off.
      state.ghost = false;
      state.police = POLICE_SECONDS;
    }
    if (state.police < 0 && !anyAlert && !cameraSees) state.alarm = Math.max(0, state.alarm - ALARM_DECAY * dt);
    if (state.police >= 0) {
      state.police -= dt;
      if (state.police <= 0) {
        state.police = 0;
        state.status = 'busted';
        events |= EVENT_BUSTED;
        return events;
      }
    }

    // --- the getaway van -----------------------------------------------------------
    if (Math.hypot(van.x - p.x, van.y - p.y) < 30 && p.lootValue >= job.quota) {
      const timeBonus = Math.max(0, Math.round(500 - 4 * state.time));
      state.score += 1000 + timeBonus + (state.ghost ? 500 : 0);
      state.status = 'clear';
      state.cleared = true;
      events |= EVENT_CLEAR;
    }
    return events;
  }

  return { state, step, hasLOS, conePolygon, coneReach, tileAt, isSolidPx };
}

export { STEP };
