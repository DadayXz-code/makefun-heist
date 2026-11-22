// MIDNIGHT VAULT — canvas rendering. Reads the world state and draws it;
// it never mutates the state.

import { TILE, VIEW_W, VIEW_H, LOOT_VALUE, TOOLS, JOBS } from './config.js';
import { carriedValue } from './world.js';

const COLORS = {
  floor: '#1b1e26',
  floorAlt: '#20242e',
  wall: '#3a3f4d',
  wallTop: '#4a5060',
  crate: '#6b5233',
  crateEdge: '#8a6b42',
  door: '#7a5a2e',
  doorOpen: '#2c2f38',
  terminal: '#1d5c46',
  terminalScreen: '#37e08a',
  vault: '#5c5c6b',
  vaultGold: '#d9a441',
  van: '#274b2e',
  vanStripe: '#e8c33a',
  player: '#e8e8e8',
  playerCoat: '#22242c',
  guard: '#c0392b',
  guardCone: 'rgba(255, 214, 90, 0.13)',
  guardConeChase: 'rgba(255, 70, 60, 0.20)',
  camera: '#7f8c9b',
  cameraCone: 'rgba(120, 200, 255, 0.12)',
  smoke: 'rgba(200, 200, 205, 0.55)',
  lootCash: '#58c96b',
  lootJewels: '#59b7e8',
  lootArt: '#c07fe8',
  lootGold: '#e8c33a',
  hud: '#e8e8e8',
  hudDim: '#9aa0ad',
  alarm: '#e74c3c',
  alarmSafe: '#58c96b',
};

function drawCone(ctx, x, y, dir, range, halfAngle, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTileFloor(ctx, job) {
  for (let ty = 0; ty < job.rows; ty++) {
    for (let tx = 0; tx < job.cols; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
}

function drawJob(ctx, state) {
  const job = state.job;
  drawTileFloor(ctx, job);

  // Walls, crates, doors, terminal, vault, van.
  for (let ty = 0; ty < job.rows; ty++) {
    for (let tx = 0; tx < job.cols; tx++) {
      const ch = job.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 4);
      } else if (ch === 'B') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (ch === 'E') {
        ctx.fillStyle = COLORS.van;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.vanStripe;
        ctx.fillRect(x, y + TILE / 2 - 3, TILE, 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VAN', x + TILE / 2, y + TILE / 2 - 8);
      }
    }
  }
  for (const door of job.doors) {
    const x = door.tx * TILE;
    const y = door.ty * TILE;
    ctx.fillStyle = door.open ? COLORS.doorOpen : COLORS.door;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    if (!door.open) {
      ctx.fillStyle = '#e8c33a';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      if (door.progress > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, y + TILE - 8, (TILE - 8) * door.progress, 3);
      }
    }
  }
  for (const term of job.terminals) {
    const x = term.tx * TILE;
    const y = term.ty * TILE;
    ctx.fillStyle = COLORS.terminal;
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.fillStyle = COLORS.terminalScreen;
    ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 18);
    if (term.progress > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + TILE - 8, (TILE - 8) * (term.progress / 2), 3);
    }
  }
  if (job.vault) {
    const v = job.vault;
    const x = v.tx * TILE;
    const y = v.ty * TILE;
    ctx.fillStyle = job.vault.open ? '#3d3d4a' : COLORS.vault;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = COLORS.vaultGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2);
    ctx.stroke();
    if (!job.vault.open && v.progress > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + TILE - 8, (TILE - 8) * (v.progress / 12), 3);
    }
    if (job.vault.open) {
      ctx.fillStyle = COLORS.vaultGold;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', x + TILE / 2, y + TILE / 2 + 3);
    }
  }

  // Loot.
  for (const loot of job.loot) {
    if (loot.taken) continue;
    const color =
      loot.kind === 'cash'
        ? COLORS.lootCash
        : loot.kind === 'jewels'
          ? COLORS.lootJewels
          : loot.kind === 'art'
            ? COLORS.lootArt
            : COLORS.lootGold;
    ctx.save();
    ctx.translate(loot.x, loot.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.fillStyle = '#0e0f13';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(loot.kind === 'cash' ? '$' : loot.kind[0].toUpperCase(), loot.x, loot.y + 3);
  }

  // Camera cones, then cameras.
  for (const cam of job.cameras) {
    const disabled = job.jobTime < cam.disabledUntil;
    if (!disabled) {
      drawCone(ctx, cam.x, cam.y, cam.angle, 250, 0.5, COLORS.cameraCone);
    }
    ctx.fillStyle = disabled ? '#3a3f4d' : COLORS.camera;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = disabled ? '#888' : '#ff5a4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(cam.angle) * 12, cam.y + Math.sin(cam.angle) * 12);
    ctx.stroke();
  }

  // Guard cones, then guards.
  for (const guard of job.guards) {
    const range = 225;
    drawCone(
      ctx,
      guard.x,
      guard.y,
      guard.dir,
      range,
      0.62,
      guard.mode === 'chase' ? COLORS.guardConeChase : COLORS.guardCone,
    );
  }
  for (const guard of job.guards) {
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.dir) * 5, guard.y + Math.sin(guard.dir) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    if (guard.mode !== 'patrol') {
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = guard.mode === 'chase' ? '#ff5040' : '#ffd65a';
      ctx.fillText(guard.mode === 'chase' ? '!' : '?', guard.x, guard.y - 16);
    }
  }

  // Smoke clouds.
  for (const s of job.smokes) {
    ctx.fillStyle = COLORS.smoke;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,220,225,0.35)';
    ctx.beginPath();
    ctx.arc(s.x - 18, s.y + 10, s.r * 0.55, 0, Math.PI * 2);
    ctx.arc(s.x + 20, s.y - 12, s.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player: a thief in a dark coat with a pale mask.
  const p = state.player;
  ctx.fillStyle = COLORS.playerCoat;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.dir) * 4, p.y + Math.sin(p.dir) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242c';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.dir) * 6, p.y + Math.sin(p.dir) * 6, 2, 0, Math.PI * 2);
  ctx.fill();

  // Player target marker (click-to-move).
  if (p.target) {
    ctx.strokeStyle = 'rgba(232,232,232,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.target.x, p.target.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx, state) {
  const job = state.job;
  ctx.fillStyle = 'rgba(10, 11, 15, 0.85)';
  ctx.fillRect(0, 0, VIEW_W, 30);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  const loot = carriedValue(job);
  ctx.fillText(`JOB ${job.index + 1} · ${job.name}`, 10, 20);
  ctx.fillText(`LOOT $${loot.toLocaleString()} / $${job.quota.toLocaleString()}`, 250, 20);
  ctx.fillText(`SCORE ${state.score.toLocaleString()}`, 480, 20);
  // Alarm bar.
  const barX = 620;
  const barW = 130;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, 10, barW, 10);
  ctx.fillStyle = job.alarm > 66 ? COLORS.alarm : job.alarm > 33 ? '#e8a33a' : COLORS.alarmSafe;
  ctx.fillRect(barX, 10, barW * (job.alarm / 100), 10);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '11px monospace';
  ctx.fillText('ALARM', barX - 48, 20);
  if (job.policeTimer !== null) {
    ctx.fillStyle = COLORS.alarm;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`POLICE ${Math.ceil(job.policeTimer)}s`, VIEW_W - 10, 20);
    ctx.textAlign = 'left';
  }
  // Tools + smoke left.
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '11px monospace';
  const toolNames = state.tools.map((id) => TOOLS.find((t) => t.id === id)?.name ?? id);
  ctx.fillText(`TOOLS: ${toolNames.join(' + ') || '—'}`, 10, VIEW_H - 8);
  if (state.tools.includes('smoke')) {
    ctx.fillText(`SMOKE x${job.smokesLeft}`, 330, VIEW_H - 8);
  }
  ctx.fillText(`CAUGHT ${job.caught}/3`, 480, VIEW_H - 8);
  ctx.fillText(`TIME ${Math.floor(job.jobTime)}s`, 620, VIEW_H - 8);
  if (job.message && job.jobTime < job.messageUntil) {
    ctx.fillStyle = '#ffd65a';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(job.message, VIEW_W / 2, 52);
    ctx.textAlign = 'left';
  }
}

function drawOverlay(ctx, title, lines, hint) {
  ctx.fillStyle = 'rgba(8, 9, 13, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#e8c33a';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 150);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '15px monospace';
  let y = 200;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 26;
  }
  if (hint) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px monospace';
    ctx.fillText(hint, VIEW_W / 2, VIEW_H - 60);
  }
  ctx.textAlign = 'left';
}

function drawPlan(ctx, state) {
  ctx.fillStyle = '#0e0f13';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#e8c33a';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MIDNIGHT VAULT', VIEW_W / 2, 70);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '15px monospace';
  ctx.fillText('The Last Job — three jobs, one getaway van.', VIEW_W / 2, 100);
  ctx.fillText('Pick exactly TWO tools for the whole run:', VIEW_W / 2, 140);
  TOOLS.forEach((tool, i) => {
    const x = 90 + i * 170;
    const y = 170;
    const picked = state.tools.includes(tool.id);
    ctx.fillStyle = picked ? '#2c4a2e' : '#1b1e26';
    ctx.fillRect(x, y, 150, 110);
    ctx.strokeStyle = picked ? '#58c96b' : '#3a3f4d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 150, 110);
    ctx.fillStyle = picked ? '#58c96b' : COLORS.hud;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`[${tool.key}] ${tool.name}`, x + 75, y + 26);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '11px monospace';
    const words = tool.blurb.split(' ');
    let line = '';
    let ly = y + 50;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 20) {
        ctx.fillText(line.trim(), x + 75, ly);
        line = w;
        ly += 15;
      } else {
        line += ' ' + w;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), x + 75, ly);
    if (picked) {
      ctx.fillStyle = '#58c96b';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('SELECTED', x + 75, y + 96);
    }
  });
  ctx.fillStyle = COLORS.hud;
  ctx.font = '14px monospace';
  ctx.fillText('Jobs: Harbor Bank $4,000 · Grand Museum $6,000 · Crown Casino $9,000', VIEW_W / 2, 320);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px monospace';
  ctx.fillText('WASD / arrows move · SHIFT run (loud) · C sneak · E hold: pick / hack / drill', VIEW_W / 2, 352);
  ctx.fillText('X smoke bomb · P pause · M mute · Click a tool card, or press 1-4', VIEW_W / 2, 374);
  ctx.fillStyle = state.tools.length === 2 ? '#58c96b' : '#e8a33a';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(
    state.tools.length === 2 ? 'Press ENTER to start the run' : `Picked ${state.tools.length}/2 tools`,
    VIEW_W / 2,
    420,
  );
  ctx.textAlign = 'left';
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.phase === 'plan') {
    drawPlan(ctx, state);
    return;
  }
  if (!state.job) {
    ctx.fillStyle = '#0e0f13';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  drawJob(ctx, state);
  drawHud(ctx, state);
  if (state.phase === 'paused') {
    drawOverlay(ctx, 'PAUSED', ['Take a breath. The guards are waiting.'], 'Press P to resume');
  } else if (state.phase === 'jobClear') {
    const c = state.lastClear;
    drawOverlay(
      ctx,
      'CLEAN GETAWAY',
      [
        `${c.name} cleared — loot $${c.loot.toLocaleString()}`,
        `Job bonus $${c.jobBonus.toLocaleString()} · Time bonus $${c.timeBonus.toLocaleString()}${
          c.ghostBonus ? ` · Ghost bonus $${c.ghostBonus}` : ''
        }`,
        `Score so far: $${state.score.toLocaleString()}`,
      ],
      'Press ENTER for the next job',
    );
  } else if (state.phase === 'busted') {
    drawOverlay(
      ctx,
      'BUSTED',
      [
        state.bustedReason === 'police'
          ? 'The police arrived before you reached the van.'
          : 'Caught three times — the crew walks away.',
        `${state.job.name} failed. Score kept: $${state.score.toLocaleString()}`,
      ],
      'Press ENTER to plan a new run',
    );
  } else if (state.phase === 'win') {
    drawOverlay(
      ctx,
      'THE LAST JOB',
      [
        `All three jobs cleared. Total loot $${state.totalLoot.toLocaleString()}.`,
        `Final score: $${state.score.toLocaleString()}`,
        state.runCaught === 0 ? 'Never caught once. A perfect night.' : `Caught ${state.runCaught} time(s) along the way.`,
      ],
      'Press ENTER to plan a new run',
    );
  }
}
