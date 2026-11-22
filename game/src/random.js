// Seeded RNG for MIDNIGHT VAULT: mulberry32. The same seed replays the
// same run, so a recorded seed is a reproducible heist.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roll an integer in [min, max] from a rng function.
export function rollInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one element of an array using a rng function.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A stable numeric hash of a short string, for turning a seed word into a
// number the generator can use.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
