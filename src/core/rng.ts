/**
 * RNG function type: returns a value in [0, 1)
 */
export type Rng = () => number;

/**
 * Create a seeded random number generator using mulberry32 algorithm
 * @param seed initial seed value
 * @returns RNG function
 */
export function makeRng(seed: number): Rng {
  return function () {
    // eslint-disable-next-line no-param-reassign
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

/**
 * Generate a random integer in range [lo, hi] (inclusive)
 * @param r RNG function
 * @param lo lower bound (inclusive)
 * @param hi upper bound (inclusive)
 * @returns random integer in [lo, hi]
 */
export function randInt(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

/**
 * Pick a random element from an array
 * @param r RNG function
 * @param xs array to pick from
 * @returns random element from xs
 */
export function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param r RNG function
 * @param xs array to shuffle
 * @returns new shuffled array
 */
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const result = [...xs];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
