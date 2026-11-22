// Keyboard + mouse input for MIDNIGHT VAULT. WASD/arrows move, SHIFT runs,
// C sneaks, E (hold) picks doors, hacks terminals and drills the vault,
// X drops a smoke bomb, P/Esc pauses, M mutes, Space/Enter confirms.
export function createInput(onKey) {
  const keys = new Set();
  let click = null;
  let smokeQueued = false;

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (k === 'x' && !e.repeat) smokeQueued = true;
    keys.add(k);
    if (onKey) onKey(k, true);
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
    if (onKey) onKey(e.key.toLowerCase(), false);
  }
  function onMouseDown(e) {
    const r = e.target.getBoundingClientRect();
    click = { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);

  function read() {
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const out = {
      x, y,
      run: keys.has('shift'),
      sneak: keys.has('c') || keys.has('control'),
      interact: keys.has('e'),
      smoke: smokeQueued,
      click,
    };
    smokeQueued = false;
    click = null;
    return out;
  }
  return { read, keys };
}
