import { expect, test } from 'vitest';
import { CROSS_CASES, crossCheck } from './crossCheck';
import { forEachWorld, solve } from './solve';
import { emptyKnowledge, emptyKnowledgeOf } from './testcases';

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
