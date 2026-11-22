// MIDNIGHT VAULT — browser entry point. Wires input, the fixed-timestep
// loop, rendering and procedural audio together. With ?shot=play|plan|alert
// |end the game renders one frozen staged scene instead of looping.

import { TILE } from './config.js';
import { TOOLS } from './config.js';
import { createGame, toggleTool, update } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const audio = createAudio();

if (shot && SHOT_NAMES.includes(shot)) {
  // One frozen frame for a screenshot; no loop, no audio.
  const state = stageShot(shot);
  render(ctx, state);
  window.__game = state;
} else {
  const state = createGame(20261122);
  const input = createInput(canvas);
  window.__game = state;

  // Sound cues, from what changed between frames.
  let prevLoot = 0;
  let prevPhase = state.phase;
  let prevCaught = 0;
  let prevDrilling = false;
  let prevAlarmFull = false;

  function soundStep() {
    const job = state.job;
    if (!job) return;
    const lootNow = job.loot.filter((l) => l.taken).length;
    if (lootNow > prevLoot) audio.pickup();
    prevLoot = lootNow;
    if (job.caught > prevCaught) audio.caught();
    prevCaught = job.caught;
    if (job.drilling && !prevDrilling) audio.drillStart();
    if (!job.drilling && prevDrilling) audio.drillStop();
    prevDrilling = job.drilling;
    const alarmFull = job.alarm >= 100;
    if (alarmFull && !prevAlarmFull) audio.alarm();
    prevAlarmFull = alarmFull;
    if (state.phase !== prevPhase) {
      if (state.phase === 'jobClear') audio.clear();
      else if (state.phase === 'win') audio.win();
      else if (state.phase === 'busted') audio.busted();
      prevPhase = state.phase;
    }
  }

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const delta = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += delta;
    const polled = input.poll();
    if (polled.mute) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
    if (polled.tool !== null && state.phase === 'plan') {
      const tool = TOOLS[polled.tool - 1];
      if (tool) {
        toggleTool(state, tool.id);
        audio.click();
      }
    }
    const target = input.takeTarget();
    if (target) {
      audio.unlock();
      if (state.phase === 'plan') {
        // Clicking a tool card toggles it.
        TOOLS.forEach((tool, i) => {
          const x = 90 + i * 170;
          if (target.x >= x && target.x <= x + 150 && target.y >= 170 && target.y <= 280) {
            toggleTool(state, tool.id);
            audio.click();
          }
        });
      } else if (state.phase === 'play') {
        state.player.target = target;
      }
    }
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(state, polled, STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    soundStep();
    render(ctx, state);
    requestAnimationFrame(frame);
  }

  // First click or keypress unlocks audio (browsers gate it).
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}
