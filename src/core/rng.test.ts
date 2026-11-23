import { describe, it, expect } from 'vitest';
import { makeRng, randInt, pick, shuffle } from './rng';

describe('rng', () => {
  it('same seed same sequence', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('shuffle keeps elements', () =>
    expect(shuffle(makeRng(1), [1, 2, 3, 4]).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]));
});
