// MIDNIGHT VAULT — staged scenes for screenshots. `?shot=play|plan|alert|end`
// loads the game frozen in one of four moments. The "end" scene clears job
// 1 with exactly $6,000 of loot in the bag.

import { TILE } from './config.js';
import { createGame, toggleTool, beginRun, update } from './world.js';

export const SHOT_NAMES = ['play', 'plan', 'alert', 'end'];

export function stageShot(name, seed = 20261122) {
  const state = createGame(seed);
  if (name === 'plan') {
    toggleTool(state, 'lockpick');
    toggleTool(state, 'drill');
    return state;
  }
  // Every other scene plays job 1 with lockpicks + drill rig.
  toggleTool(state, 'lockpick');
  toggleTool(state, 'drill');
  beginRun(state);
  const job = state.job;

  if (name === 'play') {
    // Mid-heist: the thief is deep in the bank, one guard already curious.
    state.player.x = 12 * TILE + TILE / 2;
    state.player.y = 3 * TILE + TILE / 2;
    const guard = job.guards[0];
    guard.mode = 'suspicious';
    guard.alert = 0.5;
    guard.lastSeen = { x: state.player.x, y: state.player.y };
    guard.dir = Math.atan2(state.player.y - guard.y, state.player.x - guard.x);
    job.alarm = 30;
    return state;
  }

  if (name === 'alert') {
    // Full alarm: a guard is chasing, the meter nearly maxed.
    state.player.x = 20 * TILE + TILE / 2;
    state.player.y = 2 * TILE + TILE / 2;
    const guard = job.guards[0];
    guard.x = 18 * TILE + TILE / 2;
    guard.y = 2 * TILE + TILE / 2;
    guard.mode = 'chase';
    guard.alert = 1;
    guard.lastSeen = { x: state.player.x, y: state.player.y };
    guard.dir = Math.atan2(state.player.y - guard.y, state.player.x - guard.x);
    job.alarm = 82;
    return state;
  }

  if (name === 'end') {
    // Job 1 cleared with exactly $6,000 of loot in the bag.
    job.carried.push({ kind: 'gold', value: 3000 });
    job.carried.push({ kind: 'jewels', value: 1500 });
    job.carried.push({ kind: 'cash', value: 500 });
    job.carried.push({ kind: 'cash', value: 500 });
    job.carried.push({ kind: 'cash', value: 500 });
    state.player.x = job.van.x;
    state.player.y = job.van.y;
    update(state, {}, 1 / 60);
    return state;
  }

  throw new Error(`unknown shot: ${name}`);
}
