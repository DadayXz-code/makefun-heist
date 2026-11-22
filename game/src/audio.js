// MIDNIGHT VAULT — procedural WebAudio sounds. No audio files: every
// effect is synthesized, and everything is a no-op until the player has
// interacted with the page (browsers block audio before a gesture).

export function createAudio() {
  let ctx = null;
  let muted = false;
  let drillNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    } catch {
      return null;
    }
  }

  function tone(freq, seconds, type = 'sine', volume = 0.12, slideTo = null) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + seconds);
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + seconds);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + seconds);
    } catch {
      // Audio is decoration; never break the game for it.
    }
  }

  function noiseBurst(seconds, volume = 0.1) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const len = Math.floor(ac.sampleRate * seconds);
      const buffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      gain.gain.value = volume;
      src.buffer = buffer;
      src.connect(gain).connect(ac.destination);
      src.start();
    } catch {
      // Ignore.
    }
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(m) {
      muted = !!m;
      if (muted) this.drillStop();
    },
    get muted() {
      return muted;
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.1);
      setTimeout(() => tone(1318, 0.12, 'sine', 0.08), 60);
    },
    click() {
      tone(1200, 0.05, 'square', 0.05);
    },
    door() {
      tone(300, 0.08, 'triangle', 0.1, 180);
      noiseBurst(0.05, 0.06);
    },
    hack() {
      tone(660, 0.07, 'square', 0.06);
      setTimeout(() => tone(990, 0.07, 'square', 0.06), 80);
      setTimeout(() => tone(1320, 0.1, 'square', 0.06), 160);
    },
    alarm() {
      tone(620, 0.5, 'sawtooth', 0.07, 920);
      setTimeout(() => tone(920, 0.5, 'sawtooth', 0.07, 620), 500);
    },
    caught() {
      tone(220, 0.4, 'sawtooth', 0.12, 110);
    },
    smoke() {
      noiseBurst(0.35, 0.12);
    },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.1), i * 110));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.1), i * 130));
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.1), i * 160));
    },
    drillStart() {
      if (muted || drillNodes) return;
      const ac = ensure();
      if (!ac) return;
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 90;
        gain.gain.value = 0.05;
        const lfo = ac.createOscillator();
        const lfoGain = ac.createGain();
        lfo.frequency.value = 11;
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain).connect(osc.frequency);
        osc.connect(gain).connect(ac.destination);
        osc.start();
        lfo.start();
        drillNodes = { osc, lfo, gain };
      } catch {
        drillNodes = null;
      }
    },
    drillStop() {
      if (!drillNodes) return;
      try {
        drillNodes.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        drillNodes.osc.stop(ctx.currentTime + 0.1);
        drillNodes.lfo.stop(ctx.currentTime + 0.1);
      } catch {
        // Ignore.
      }
      drillNodes = null;
    },
  };
}
