// Procedural WebAudio for MIDNIGHT VAULT: no sound files, every effect is
// synthesised. Footsteps, guard steps by distance, pickups, the vault drill,
// camera bleeps, suspicion, the alarm, getting caught, and the getaway.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let drillNode = null;

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol = 0.1, freq = 800) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  return {
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (drillNode) this.stopDrill(); return muted; },
    step(run) { noiseBurst(0.05, run ? 0.09 : 0.045, run ? 1200 : 500); },
    guardStep(dist) {
      if (dist > 320) return;
      noiseBurst(0.06, 0.11 * (1 - dist / 340), 300);
    },
    pickup() { tone(660, 0.09, 'sine', 0.12); tone(990, 0.12, 'sine', 0.1, null, 0.07); },
    gold() { tone(523, 0.1, 'triangle', 0.14); tone(784, 0.1, 'triangle', 0.12, null, 0.08); tone(1046, 0.16, 'triangle', 0.12, null, 0.16); },
    door() { tone(220, 0.12, 'square', 0.06, 330); },
    hack() { tone(880, 0.08, 'square', 0.07); tone(1174, 0.08, 'square', 0.07, null, 0.09); tone(1568, 0.14, 'square', 0.08, null, 0.18); },
    cameraBleep() { tone(1568, 0.07, 'square', 0.05); },
    suspicious() { tone(392, 0.16, 'triangle', 0.12, 523); },
    alarm() { tone(440, 0.22, 'sawtooth', 0.09, 880); tone(880, 0.22, 'sawtooth', 0.07, 440, 0.22); },
    caught() { tone(220, 0.3, 'sawtooth', 0.14, 110); noiseBurst(0.25, 0.12, 400); },
    smoke() { noiseBurst(0.4, 0.1, 900); },
    startDrill() {
      if (muted || drillNode) return;
      const c = ac();
      if (!c) return;
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 90;
      const g = c.createGain();
      g.gain.value = 0.05;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 400;
      o.connect(f).connect(g).connect(c.destination);
      o.start();
      drillNode = { o, g };
    },
    stopDrill() {
      if (!drillNode) return;
      try { drillNode.o.stop(); } catch { /* already stopped */ }
      drillNode = null;
    },
    clear() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, null, i * 0.11)); },
    win() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.24, 'triangle', 0.13, null, i * 0.13)); },
    busted() { [392, 370, 349, 311].forEach((f, i) => tone(f, 0.26, 'sawtooth', 0.1, null, i * 0.18)); },
  };
}
