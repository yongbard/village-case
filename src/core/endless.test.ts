import { expect, test } from 'vitest';
import { caseScore, generateEndless, meetsFloor, pickEndless } from './endless';
import { type Step } from './explain';
import { TIME_SCALE } from './testcases';

const step = (cells: number[], extra: Partial<Step> = {}): Step => ({
  cell: 0,
  claim: 'good',
  because: cells.map((cell) => ({ type: 'clue' as const, cell })),
  usesEarlier: false,
  ...extra,
});

test('caseScore counts distinct statement cells and treats all as the whole board', () => {
  expect(caseScore([step([0, 2]), step([2, 5]), step([])], 16).statementCells).toBe(3);
  expect(caseScore([step([0, 2]), { ...step([]), because: 'all' }], 16).statementCells).toBe(16);
  expect(caseScore([step([1]), { ...step([]), because: [{ type: 'ability', index: 0 }] }], 16).statementCells).toBe(1);
});

test('floor: statements from at least 35% of the cells and difficulty 2 or more', () => {
  expect(meetsFloor({ difficulty: 2, statementCells: 6 }, 16)).toBe(true);
  expect(meetsFloor({ difficulty: 2, statementCells: 5 }, 16)).toBe(false);
  expect(meetsFloor({ difficulty: 1, statementCells: 9 }, 16)).toBe(false);
  expect(meetsFloor({ difficulty: 3, statementCells: 7 }, 20)).toBe(true);
  expect(meetsFloor({ difficulty: 3, statementCells: 6 }, 20)).toBe(false);
});

test('same n and seed give the same case', () => {
  for (const n of [1, 13]) expect(generateEndless(n, 77)).toEqual(generateEndless(n, 77));
});

test('case keeps the seed it was asked for', () => {
  expect(generateEndless(5, 4242).seed).toBe(4242);
});

test('most seeds clear the floor', () => {
  for (const n of [1, 4, 8, 13]) {
    const ok = Array.from({ length: 8 }, (_, s) => pickEndless(n, 300 + s)).filter((p) => p.cleared).length;
    expect(ok, `n=${n}`).toBeGreaterThanOrEqual(7);
  }
}, 120_000);

test('endless case generation stays under the time limit', () => {
  for (const n of [1, 13, 30]) for (let s = 0; s < 3; s++) {
    const t = performance.now();
    generateEndless(n, 500 + s);
    expect(performance.now() - t, `n=${n} seed ${500 + s}`).toBeLessThan(2500 * TIME_SCALE);
  }
}, 120_000);

// 사건 코드 고정: 같은 (n, 시드)가 늘 같은 사건인지 (기기 사이뿐 아니라 코드를 고친 뒤에도).
// 일의 양을 바꾸는 수정(탐색 순서, CHECK_COST, overBudget 부르는 자리, WORK·CANDIDATES·기준)은 후보 선택을 바꿔
// 이어 하던 판과 공유한 사건 코드를 다른 사건으로 만든다. 이 시험이 깨지면 그 영향을 알고 값을 새로 적는다.
const fingerprint = (d: object) => {
  let h = 2166136261;
  for (const ch of JSON.stringify(d)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16);
};
test('endless case codes are pinned (first, later and over-limit candidates)', () => {
  const golden: [number, number, string, number, string][] = [
    [1, 1, 'floor', 0, '122f2c2'],
    [1, 3, 'floor', 4, 'd974fa19'],
    [1, 23, 'over', 0, '95d0c052'],
    [8, 19, 'over', 1, '511fa76d'],
    [8, 47, 'floor', 1, 'f9ae8323'],
    [13, 4, 'over', 1, '2b5d2b1b'],
    [13, 12, 'floor', 2, 'd5b100e6'],
  ];
  for (const [n, seed, how, candidate, fp] of golden) {
    const p = pickEndless(n, seed);
    expect([p.how, p.candidate, fingerprint({ faces: p.def.faces, clues: p.def.clues, truth: p.def.truth })], `n=${n} seed ${seed}`).toEqual([how, candidate, fp]);
  }
}, 60_000);
