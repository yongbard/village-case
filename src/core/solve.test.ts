import { expect, test } from 'vitest';
import { crossCheckSlice } from './crossCheck';
import { forEachWorld, solve } from './solve';
import { emptyKnowledge, emptyKnowledgeOf } from './testcases';

// 3000판 교차 검증은 6개 파일(solve.test.ts, solve.cross2~6.test.ts)이 나눠 돈다. 파일끼리 병렬로 돈다.
test('backtracking equals brute force on 3000 random small cases (1/6)', () => {
  crossCheckSlice(1);
}, 120_000);

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
