// Seeded random numbers for Port Solano: every deterministic run (screenshots,
// replays) starts from the same seed, so the same seed always builds the same city
// and the same traffic. Plain mulberry32, no dependencies.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a random function. */
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one item from an array with a random function. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** A random float in [min, max). */
export function floatBetween(rng, min, max) {
  return min + rng() * (max - min);
}
