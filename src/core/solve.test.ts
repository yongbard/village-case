import { expect, test } from 'vitest';
import { CROSS_CASES, crossCheck } from './crossCheck';
import { makeRng, shuffle } from './rng';
import { forEachWorld, solve, worldKey } from './solve';
import { emptyKnowledge, emptyKnowledgeOf, randomInPlay, randomKnowledge, randomTruth } from './testcases';

// 기본 600판(npm test). 3000판 전체는 npm run test:cross (CROSS_CASES=3000).
test(`backtracking equals brute force on ${CROSS_CASES} random small cases`, () => {
  crossCheck(0, CROSS_CASES);
}, Math.max(120_000, CROSS_CASES * 200));

test('cap stops enumeration', () => {
  const k = emptyKnowledge(4, 5, ['gossip', 'thief', 'blackmailer', 'lookout', 'chief']);
  const res = solve(k, 50);
  expect(res.capped).toBe(true);
  expect(res.worlds.length).toBe(50);
});

test('forEachWorld stops when visit returns true', () => {
  let seen = 0;
  forEachWorld(emptyKnowledge(3, 3, ['thief', 'chief']), () => ++seen === 3);
  expect(seen).toBe(3);
});

test('not capped when all worlds fit; emptyKnowledgeOf matches emptyKnowledge', () => {
  const k = emptyKnowledgeOf({ seed: 1, w: 3, h: 3, truth: { roles: [], taint: [] }, faces: [], clues: [], inPlay: ['thief', 'chief'] });
  expect(k).toEqual(emptyKnowledge(3, 3, ['thief', 'chief']));
  const res = solve(k);
  expect(res.capped).toBe(false);
  expect(res.worlds.length).toBe(9 * 8);
});

test('fill order changes speed only, not the set of worlds', () => {
  const r = makeRng(11);
  const keys = (k: Parameters<typeof forEachWorld>[0], order?: number[]) => {
    const out: string[] = [];
    forEachWorld(k, (w) => void out.push(worldKey(w)), order);
    return out.sort();
  };
  for (let t = 0; t < 300; t++) {
    const [w, h] = ([[3, 3], [3, 4], [4, 3]] as const)[t % 3];
    const truth = randomTruth(r, w, h, randomInPlay(r, 4));
    const k = randomKnowledge(r, truth, w, h);
    const n = w * h;
    const base = keys(k);
    expect(keys(k, Array.from({ length: n }, (_, i) => n - 1 - i)), `reversed ${t}`).toEqual(base);
    expect(keys(k, shuffle(r, Array.from({ length: n }, (_, i) => i))), `shuffled ${t}`).toEqual(base);
  }
}, 120_000);

test('order must be a permutation', () => {
  expect(() => forEachWorld(emptyKnowledge(3, 3, ['thief', 'chief']), () => true, [0, 1, 2])).toThrow();
});
