// MIDNIGHT VAULT — canvas drawing: the building, the cones, the HUD, and
// the title / plan / pause / clear / busted / win screens. The map sits
// under a 60 px HUD bar, so the canvas is 960 by 660.
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, LOOT, TOOLS, ALARM_MAX, SUSPECT_AT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAN = 'plan';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

export const MAP_Y = 60;
export const CANVAS_W = VIEW_W;
export const CANVAS_H = VIEW_H + MAP_Y;

// Plan-screen tool cards (also the click zones main.js reads).
export const PLAN_CARDS = TOOLS.map((t, i) => ({
  id: t.id, x: 90 + i * 205, y: 300, w: 185, h: 150,
}));

export function planCardAt(x, y) {
  const card = PLAN_CARDS.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
  return card ? card.id : null;
}

const FLOOR_A = '#171b30';
const FLOOR_B = '#1a1f38';
const WALL = '#2e3a5c';
const WALL_TOP = '#42548a';

function drawCone(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y + MAP_Y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + MAP_Y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawGuard(ctx, g, world) {
  const y = g.y + MAP_Y;
  const cone = world.conePolygon(g.x, g.y, g.angle, 0.58, 195);
  const fill = g.state === 'alert'
    ? 'rgba(255,60,60,0.38)'
    : g.state === 'suspect'
      ? 'rgba(255,170,40,0.30)'
      : 'rgba(255,183,77,0.22)';
  drawCone(ctx, cone, fill);
  // body
  ctx.beginPath();
  ctx.arc(g.x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#78350f';
  ctx.stroke();
  // facing tick
  ctx.beginPath();
  ctx.moveTo(g.x, y);
  ctx.lineTo(g.x + Math.cos(g.angle) * 17, y + Math.sin(g.angle) * 17);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1f2937';
  ctx.stroke();
  // state mark + suspicion bar
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  if (g.state === 'alert') {
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('!', g.x, y - 22);
  } else if (g.state === 'suspect' || g.suspicion >= SUSPECT_AT) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('?', g.x, y - 22);
  }
  if (g.suspicion > 8) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(g.x - 16, y - 19, 32, 5);
    ctx.fillStyle = g.suspicion >= SUSPECT_AT ? '#f59e0b' : '#fde68a';
    ctx.fillRect(g.x - 16, y - 19, 32 * (g.suspicion / 100), 5);
  }
}

function drawCamera(ctx, c, world) {
  const y = c.y + MAP_Y;
  if (world.state.camerasOff > 0) {
    // Hacked: grey and harmless.
    ctx.beginPath();
    ctx.arc(c.x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#6b7280';
    ctx.fill();
    return;
  }
  const cone = world.conePolygon(c.x, c.y, c.angle, 0.5, 175);
  drawCone(ctx, cone, c.sees ? 'rgba(255,45,85,0.42)' : 'rgba(255,77,141,0.22)');
  // mount + lens
  ctx.fillStyle = '#374151';
  ctx.fillRect(c.x - 10, y - 6, 20, 12);
  ctx.beginPath();
  ctx.arc(c.x + Math.cos(c.angle) * 12, y + Math.sin(c.angle) * 12, 5, 0, Math.PI * 2);
  ctx.fillStyle = c.sees ? '#ff2d55' : '#ff4d8d';
  ctx.fill();
  if (c.sees) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2d55';
    ctx.fillText('SEEN', c.x, y - 18);
  }
}

function drawLoot(ctx, l) {
  const y = l.y + MAP_Y;
  const def = LOOT[l.kind];
  ctx.save();
  ctx.translate(l.x, y);
  if (l.kind === 'cash') {
    ctx.fillStyle = def.color;
    ctx.fillRect(-11, -7, 22, 14);
    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
  } else if (l.kind === 'jewels') {
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (l.kind === 'art') {
    ctx.fillStyle = '#f5d0fe';
    ctx.fillRect(-10, -12, 20, 24);
    ctx.strokeStyle = '#a21caf';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -12, 20, 24);
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#a21caf';
    ctx.fill();
    ctx.fillRect(-6, 6, 12, 2);
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(-10, -6, 20, 12);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-10, -6, 20, 4);
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Au', 0, 10);
  }
  ctx.restore();
}

function drawMap(ctx, world) {
  const s = world.state;
  const grid = s.job.map;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      const x = tx * TILE, y = ty * TILE + MAP_Y;
      if (ch === '#') {
        ctx.fillStyle = WALL;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 5);
      } else if (ch === 'M') {
        ctx.fillStyle = WALL;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 5);
      } else {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(x, y, TILE, TILE);
      }
      if (ch === 'C') {
        ctx.fillStyle = '#8a6d3b';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = '#5d4a26';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + TILE - 4, y + TILE - 4);
        ctx.moveTo(x + TILE - 4, y + 4);
        ctx.lineTo(x + 4, y + TILE - 4);
        ctx.stroke();
      } else if (ch === 'B') {
        ctx.fillStyle = 'rgba(20,60,40,0.85)';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#22c55e';
        for (const [dx, dy] of [[10, 12], [22, 20], [30, 28], [16, 30]]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ch === 'V') {
        ctx.fillStyle = '#7d8aa5';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = s.vault.open ? '#22c55e' : '#fbbf24';
        ctx.fillRect(x + 4, y + TILE - 10, TILE - 8, 5);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
      } else if (ch === 'D') {
        const d = s.doors.find((dd) => dd.tx === tx && dd.ty === ty);
        if (d && !d.open) {
          ctx.fillStyle = '#6b4f2a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          if (d.progress > 0) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(x + 4, y + 4, TILE - 8, 5);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x + 4, y + 4, (TILE - 8) * d.progress, 5);
          }
        } else {
          ctx.fillStyle = '#3f2d17';
          ctx.fillRect(x, y, TILE, TILE);
        }
      } else if (ch === 'T') {
        ctx.fillStyle = '#1f3b4d';
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = s.terminal && s.terminal.used ? '#475569' : '#22d3ee';
        ctx.fillRect(x + 9, y + 9, TILE - 18, 12);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAM', x + TILE / 2, y + 18);
        if (s.terminal && s.terminal.progress > 0 && !s.terminal.used) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(x + 4, y + TILE - 9, TILE - 8, 5);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(x + 4, y + TILE - 9, (TILE - 8) * s.terminal.progress, 5);
        }
      } else if (ch === 'E') {
        ctx.fillStyle = '#14532d';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = s.player.lootValue >= s.job.quota ? '#4ade80' : '#166534';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#bbf7d0';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VAN', x + TILE / 2, y + TILE / 2 + 4);
      }
    }
  }
  // Vault drill progress, drawn over the vault.
  if (!s.vault.open && s.vault.progress > 0) {
    const vx = (s.vault.x + s.vault.w / 2) * TILE;
    ctx.fillStyle = '#111827';
    ctx.fillRect(vx - 40, (s.vault.y + 1) * TILE + MAP_Y + 8, 80, 7);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(vx - 40, (s.vault.y + 1) * TILE + MAP_Y + 8, 80 * s.vault.progress, 7);
  }
  // Smoke clouds.
  for (const sm of s.smokes) {
    ctx.beginPath();
    ctx.arc(sm.x, sm.y + MAP_Y, 90, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(148,163,184,${0.25 + 0.2 * (sm.t / 8)})`;
    ctx.fill();
  }
  // Loot, cameras, guards, thief.
  for (const l of s.loot) if (!l.taken) drawLoot(ctx, l);
  for (const c of s.cameras) drawCamera(ctx, c, world);
  for (const g of s.guards) drawGuard(ctx, g, world);
  const p = s.player;
  const py = p.y + MAP_Y;
  ctx.beginPath();
  ctx.arc(p.x, py, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#2dd4bf';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#134e4a';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, py);
  ctx.lineTo(p.x + Math.cos(p.angle) * 17, py + Math.sin(p.angle) * 17);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();
  if (p.carrying.length > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`$${p.lootValue.toLocaleString('en-US')}`, p.x, py - 20);
  }
}

function drawHUD(ctx, world, ui) {
  const s = world.state;
  ctx.fillStyle = '#0b0e1d';
  ctx.fillRect(0, 0, CANVAS_W, MAP_Y);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(s.job.name, 14, 24);
  ctx.font = '14px sans-serif';
  const quotaOk = s.player.lootValue >= s.job.quota;
  ctx.fillStyle = quotaOk ? '#4ade80' : '#fbbf24';
  ctx.fillText(`LOOT $${s.player.lootValue.toLocaleString('en-US')} / $${s.job.quota.toLocaleString('en-US')}`, 14, 46);
  // Alarm bar.
  const ax = 330, aw = 190;
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ALARM', ax, 24);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(ax + 62, 12, aw, 14);
  const alarmFrac = s.alarm / ALARM_MAX;
  ctx.fillStyle = s.police >= 0 ? '#ef4444' : alarmFrac > 0.6 ? '#f97316' : '#eab308';
  ctx.fillRect(ax + 62, 12, aw * alarmFrac, 14);
  if (s.police >= 0) {
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`POLICE ${Math.ceil(s.police)}s`, ax + 62, 46);
  } else {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px sans-serif';
    ctx.fillText(s.camerasOff > 0 ? `CAMS OFF ${Math.ceil(s.camerasOff)}s` : 'cameras live', ax + 62, 46);
  }
  // Catches, timer, score, tools.
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`♥ ${3 - s.catches}`, 640, 24);
  ctx.fillText(fmtTime(s.time), 640, 46);
  ctx.fillText(`SCORE ${s.score.toLocaleString('en-US')}`, 800, 24);
  ctx.fillText(`SMOKE ${s.smokesLeft} [X]`, 800, 46);
  ctx.fillText(`BEST ${ui.best.toLocaleString('en-US')}`, 950, 24);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.fillText(s.tools.map((t) => TOOLS.find((tt) => tt.id === t).name).join(' · ') || 'no tools', 950, 46);
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function overlay(ctx, title, lines, accent = '#2dd4bf') {
  ctx.fillStyle = 'rgba(5,8,20,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, CANVAS_W / 2, 250);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '18px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, CANVAS_W / 2, 300 + i * 30));
}

export function draw(ctx, world, screen, ui) {
  const s = world.state;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#0b0e1d';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, ui);
    return;
  }
  if (screen === SCREEN_PLAN) {
    drawPlan(ctx, ui);
    return;
  }
  drawMap(ctx, world);
  drawHUD(ctx, world, ui);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · SHIFT run (loud) · C sneak · E hold: pick / hack / drill · X smoke · P pause', 12, CANVAS_H - 8);
  if (screen === SCREEN_PAUSED) {
    overlay(ctx, 'PAUSED', ['Take a breath. The guards are not waiting.', 'Press P to keep going.']);
  } else if (screen === SCREEN_CLEAR) {
    const timeBonus = Math.max(0, Math.round(500 - 4 * s.time));
    overlay(ctx, 'CLEAN GETAWAY', [
      `${s.job.name} — quota $${s.job.quota.toLocaleString('en-US')} met, $${s.player.lootValue.toLocaleString('en-US')} in the bag.`,
      `Job bonus +1,000 · time bonus +${timeBonus}${s.ghost ? ' · ghost bonus +500' : ''}`,
      `Score ${s.score.toLocaleString('en-US')} — press SPACE for the next job.`,
    ], '#4ade80');
  } else if (screen === SCREEN_BUSTED) {
    overlay(ctx, 'BUSTED', [
      s.police <= 0 ? 'The police arrived before you reached the van.' : 'Caught three times — the crew walks away.',
      `You kept $${s.player.lootValue.toLocaleString('en-US')} of loot. Score ${s.score.toLocaleString('en-US')}.`,
      'Press SPACE to run the job again.',
    ], '#ef4444');
  } else if (screen === SCREEN_WIN) {
    overlay(ctx, 'THE LAST JOB — DONE', [
      'Three jobs, one clean getaway. The crew retires rich.',
      `Final score ${s.score.toLocaleString('en-US')} — press SPACE to plan it all again.`,
    ], '#fbbf24');
  }
}

function drawTitle(ctx, ui) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('MIDNIGHT VAULT', CANVAS_W / 2, 190);
  ctx.fillStyle = '#2dd4bf';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('— The Last Job —', CANVAS_W / 2, 232);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '18px sans-serif';
  ctx.fillText('Plan the crew. Slip past the guards. Beat the cameras.', CANVAS_W / 2, 290);
  ctx.fillText('Crack the vault, grab the loot, and reach the van before the police do.', CANVAS_W / 2, 318);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Three jobs: Harbor Bank · Grand Museum · Crown Casino', CANVAS_W / 2, 380);
  ctx.fillText('WASD move · SHIFT run · C sneak · E hold to interact · X smoke bomb', CANVAS_W / 2, 410);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press SPACE or click to plan the job', CANVAS_W / 2, 480);
  if (ui.best > 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Best score ${ui.best.toLocaleString('en-US')}`, CANVAS_W / 2, 520);
  }
}

function drawPlan(ctx, ui) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PLAN THE JOB', CANVAS_W / 2, 120);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '17px sans-serif';
  ctx.fillText('Pick exactly two tools for the whole run. Every tool is free —', CANVAS_W / 2, 160);
  ctx.fillText('but the two you leave behind will be missed.', CANVAS_W / 2, 186);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '15px sans-serif';
  ctx.fillText('Quota: Harbor Bank $4,000 · Grand Museum $6,000 · Crown Casino $9,000', CANVAS_W / 2, 230);
  TOOLS.forEach((t, i) => {
    const c = PLAN_CARDS[i];
    const sel = ui.selected.includes(t.id);
    ctx.fillStyle = sel ? '#14532d' : '#1e293b';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = sel ? '#4ade80' : '#475569';
    ctx.lineWidth = sel ? 3 : 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(t.name, c.x + c.w / 2, c.y + 34);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    wrapText(ctx, t.blurb, c.x + c.w / 2, c.y + 62, c.w - 20, 18);
    ctx.fillStyle = sel ? '#4ade80' : '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(sel ? '✓ TAKEN' : `press ${i + 1}`, c.x + c.w / 2, c.y + c.h - 16);
  });
  ctx.fillStyle = ui.selected.length === 2 ? '#fbbf24' : '#64748b';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(
    ui.selected.length === 2 ? 'Press ENTER to start the job' : `Pick ${2 - ui.selected.length} more tool${2 - ui.selected.length === 1 ? '' : 's'} (click or press 1–4)`,
    CANVAS_W / 2, 510,
  );
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
