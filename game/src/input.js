// MIDNIGHT VAULT — keyboard and mouse input. The browser loop polls this
// once per frame; edge-triggered keys (smoke, pause, enter, mute) read true
// only on the frame they were pressed.

import { TILE } from './config.js';

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyC: 'sneak',
  KeyE: 'interact',
  KeyX: 'smoke',
  KeyP: 'pause',
  Enter: 'enter',
  KeyM: 'mute',
  Digit1: 'tool1',
  Digit2: 'tool2',
  Digit3: 'tool3',
  Digit4: 'tool4',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let target = null;

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }
  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    target = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);

  // Read the current input for one frame. Edge keys are consumed here, so
  // a press is never reported twice.
  function poll() {
    const out = {
      up: held.has('up'),
      down: held.has('down'),
      left: held.has('left'),
      right: held.has('right'),
      run: held.has('run'),
      sneak: held.has('sneak'),
      interact: held.has('interact'),
      smoke: pressed.has('smoke'),
      pause: pressed.has('pause'),
      enter: pressed.has('enter'),
      mute: pressed.has('mute'),
      tool: null,
    };
    for (let i = 1; i <= 4; i++) {
      if (pressed.has(`tool${i}`)) out.tool = i;
    }
    pressed.clear();
    return out;
  }

  // The click-to-move target, in canvas pixels (null when none / consumed).
  function takeTarget() {
    const t = target;
    target = null;
    return t;
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('click', onClick);
  }

  return { poll, takeTarget, dispose };
}
