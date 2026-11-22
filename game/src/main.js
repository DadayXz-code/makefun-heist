// MIDNIGHT VAULT — the game loop. Fixed 1/60 s steps, three jobs in a run,
// a plan phase up front, and ?shot=plan|play|alert|end scenes for the
// screenshots (same seed, same frame, every time).
import { STEP, VIEW_W, VIEW_H, JOBS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CLEAR, EVENT_BUSTED, EVENT_CAUGHT } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  draw, planCardAt, CANVAS_W, CANVAS_H,
  SCREEN_TITLE, SCREEN_PLAN, SCREEN_PLAY, SCREEN_PAUSED,
  SCREEN_CLEAR, SCREEN_BUSTED, SCREEN_WIN,
} from './render.js';
import { applyShot, TOOLS as SHOT_TOOLS, END_TOOLS } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');
const debug = params.get('debug') === '1';

const audio = createAudio();
const input = createInput(onKey);
const bestKey = 'midnight-vault-best';
let best = Number(localStorage.getItem(bestKey) || 0);

let screen = SCREEN_TITLE;
let jobIndex = 0;
let runScore = 0;
let selectedTools = [];
let world = null;
let lastLoot = 0;
let lastAlarmMaxed = false;
let stepSoundT = 0;
let guardSoundT = 0;
let bleepT = 0;

function newJob(index, tools) {
  world = createWorld(createRandom(seed + index * 101), index, tools);
  world.state.score = runScore;
  lastLoot = 0;
  lastAlarmMaxed = false;
}

function startRun(tools) {
  jobIndex = 0;
  runScore = 0;
  newJob(0, tools);
  screen = SCREEN_PLAY;
}

function onKey(k, down) {
  if (!down) return;
  if (k === 'm') {
    audio.toggleMute();
    return;
  }
  if (screen === SCREEN_TITLE) {
    if (k === ' ' || k === 'enter') { screen = SCREEN_PLAN; selectedTools = []; }
    return;
  }
  if (screen === SCREEN_PLAN) {
    const idx = ['1', '2', '3', '4'].indexOf(k);
    if (idx >= 0) toggleTool(['lockpicks', 'smoke', 'drill', 'disguise'][idx]);
    if ((k === 'enter' || k === ' ') && selectedTools.length === 2) startRun([...selectedTools]);
    return;
  }
  if (screen === SCREEN_PLAY) {
    if (k === 'p' || k === 'escape') { screen = SCREEN_PAUSED; audio.stopDrill(); }
    return;
  }
  if (screen === SCREEN_PAUSED) {
    if (k === 'p' || k === 'escape') screen = SCREEN_PLAY;
    return;
  }
  if (screen === SCREEN_CLEAR) {
    if (k === ' ' || k === 'enter') {
      runScore = world.state.score;
      jobIndex += 1;
      if (jobIndex >= JOBS.length) { screen = SCREEN_WIN; }
      else { newJob(jobIndex, world.state.tools); screen = SCREEN_PLAY; }
    }
    return;
  }
  if (screen === SCREEN_BUSTED) {
    if (k === ' ' || k === 'enter') { newJob(jobIndex, world.state.tools); screen = SCREEN_PLAY; }
    return;
  }
  if (screen === SCREEN_WIN) {
    if (k === ' ' || k === 'enter') { screen = SCREEN_TITLE; }
  }
}

function toggleTool(id) {
  const i = selectedTools.indexOf(id);
  if (i >= 0) selectedTools.splice(i, 1);
  else if (selectedTools.length < 2) selectedTools.push(id);
}

canvas.addEventListener('click', () => {
  if (screen === SCREEN_TITLE) { screen = SCREEN_PLAN; selectedTools = []; }
});

// Plan-screen card clicks are read from the frame's single input read.
function frame() {
  const inp = input.read();
  if (inp.click && screen === SCREEN_PLAN) {
    const rect = canvas.getBoundingClientRect();
    const x = (inp.click.x / rect.width) * CANVAS_W;
    const y = (inp.click.y / rect.height) * CANVAS_H;
    const id = planCardAt(x, y);
    if (id) toggleTool(id);
  }
  if (screen === SCREEN_PLAY && world) {
    const s = world.state;
    const prevX = s.player.x, prevY = s.player.y;
    const events = world.step(STEP, inp, performance.now() / 1000);
    // Sounds.
    const moved = Math.hypot(s.player.x - prevX, s.player.y - prevY);
    if (moved > 1) {
      stepSoundT -= STEP;
      if (stepSoundT <= 0) { audio.step(inp.run); stepSoundT = inp.run ? 0.22 : 0.38; }
    }
    guardSoundT -= STEP;
    if (guardSoundT <= 0) {
      const nearest = Math.min(...s.guards.map((g) => Math.hypot(g.x - s.player.x, g.y - s.player.y)));
      audio.guardStep(nearest);
      guardSoundT = 0.5;
    }
    const nearVault = !s.vault.open && Math.hypot((s.vault.x + s.vault.w / 2) * 40 - s.player.x, (s.vault.y + s.vault.h / 2) * 40 - s.player.y) < 78 && inp.interact;
    if (nearVault) audio.startDrill(); else audio.stopDrill();
    if (s.player.lootValue > lastLoot) {
      audio.gold();
      lastLoot = s.player.lootValue;
    }
    if (s.cameras.some((c) => c.sees)) {
      bleepT -= STEP;
      if (bleepT <= 0) { audio.cameraBleep(); bleepT = 1.1; }
    }
    if (s.alarm >= 100 && !lastAlarmMaxed) { audio.alarm(); lastAlarmMaxed = true; }
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_BUSTED) { audio.stopDrill(); audio.busted(); screen = SCREEN_BUSTED; }
    else if (events & EVENT_CLEAR) {
      audio.stopDrill();
      if (jobIndex >= JOBS.length - 1) { audio.win(); screen = SCREEN_WIN; }
      else { audio.clear(); screen = SCREEN_CLEAR; }
      if (world.state.score > best) {
        best = world.state.score;
        localStorage.setItem(bestKey, String(best));
      }
    }
  }
  draw(ctx, world || newJobWorld(), screen, {
    selected: selectedTools,
    best,
  });
  requestAnimationFrame(frame);
}

// A throwaway world so the title screen can draw behind the overlay.
let titleWorld = null;
function newJobWorld() {
  if (!titleWorld) titleWorld = createWorld(createRandom(seed), 0, SHOT_TOOLS);
  return titleWorld;
}

if (shot) {
  // Screenshot staging: deterministic, no waiting for input.
  if (shot === 'plan') {
    selectedTools = [...SHOT_TOOLS];
    screen = SCREEN_PLAN;
  } else {
    // The end run drills the vault under smoke, so it carries smoke + drill.
    newJob(0, shot === 'end' ? END_TOOLS : SHOT_TOOLS);
    screen = applyShot(world, shot, createRandom(seed));
    if (screen === SCREEN_CLEAR) {
      if (world.state.score > best) best = world.state.score;
    }
  }
  draw(ctx, world || newJobWorld(), screen, { selected: selectedTools, best });
  window.__shotReady = true;
  if (debug) window.__heist = world;
} else {
  requestAnimationFrame(frame);
  if (debug) {
    Object.defineProperty(window, '__heist', { get: () => world });
  }
}
