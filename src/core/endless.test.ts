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
