import { expect, test } from 'vitest';
import { endlessParams, generateValid } from './generate';
import { ROLES } from './roles';
import { consistent } from './rules';
import { abilityCells, checkCase, fullKnowledge, signature } from './unique';

test('generated cases: truth consistent, unique, matches truth', () => {
  for (let n = 1; n <= 30; n++) for (let s = 0; s < 5; s++) {
    const def = generateValid(endlessParams(n), n * 1000 + s);
    expect(consistent(fullKnowledge(def), def.truth)).toBe(true);
    const res = checkCase(def);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.signature).toBe(signature(def.truth));
    expect(abilityCells(def).length).toBeLessThanOrEqual(2);
  }
}, 120_000);

test('same seed same case', () =>
  expect(generateValid(endlessParams(10), 99)).toEqual(generateValid(endlessParams(10), 99)));

test('case seed is the seed given to generateValid', () => {
  expect(generateValid(endlessParams(10), 99).seed).toBe(99);
  expect(generateValid(endlessParams(1), 12345).seed).toBe(12345);
});

test('must roles always present', () => {
  const def = generateValid({ w: 3, h: 4, trouble: 1, accomplice: 2, pool: ['postman', 'pharmacist', 'mayor', 'guard', 'baker', 'photographer', 'braggart', 'lost', 'thief', 'blackmailer', 'lookout', 'chief'], must: ['blackmailer', 'lost'] }, 5);
  expect(def.inPlay).toEqual(expect.arrayContaining(['blackmailer', 'lost']));
});

test('endless generation is fast enough', () => { // Review Focus 1
  for (const n of [1, 10, 20, 30]) {
    const t = performance.now(); generateValid(endlessParams(n), n);
    expect(performance.now() - t).toBeLessThan(1000);
  }
});

test('endlessParams: n=1 start, n>=25 cap, monotone', () => {
  const p1 = endlessParams(1);
  expect([p1.w, p1.h, p1.accomplice, p1.trouble]).toEqual([3, 3, 1, 0]);
  expect(p1.pool.every((id) => ROLES[id].tier === 1)).toBe(true);
  for (const n of [25, 40]) {
    const p = endlessParams(n);
    expect([p.w, p.h, p.trouble, p.accomplice]).toEqual([4, 5, 3, 3]);
    expect(p.pool.length).toBe(20);
  }
  for (let n = 2; n <= 30; n++) {
    const a = endlessParams(n - 1);
    const b = endlessParams(n);
    expect(b.w * b.h).toBeGreaterThanOrEqual(a.w * a.h);
    expect(b.accomplice).toBeGreaterThanOrEqual(a.accomplice);
    expect(b.trouble).toBeGreaterThanOrEqual(a.trouble);
    expect(b.pool.length).toBeGreaterThanOrEqual(a.pool.length);
  }
});
