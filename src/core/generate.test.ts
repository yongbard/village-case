import { expect, test } from 'vitest';
import { endlessParams, generateValid } from './generate';
import { ROLES } from './roles';
import { consistent } from './rules';
import { TIME_SCALE } from './testcases';
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

const POOL = ['postman', 'pharmacist', 'grandma', 'dog', 'mayor', 'guard', 'restaurant', 'braggart', 'lost', 'thief', 'shill', 'lookout', 'chief'];

test('must roles always present', () => {
  const def = generateValid({ w: 3, h: 4, trouble: 1, accomplice: 2, boss: 1, pool: POOL, must: ['shill', 'lost'] }, 5);
  expect(def.inPlay).toEqual(expect.arrayContaining(['shill', 'lost']));
});

test('roster matches truth and includes witnesses', () => {
  for (const s of [1, 2, 3]) {
    const def = generateValid(endlessParams(10), s);
    const total = Object.values(def.roster).reduce((a, b) => a + b, 0);
    expect(total).toBe(def.w * def.h);
    for (const [id, c] of Object.entries(def.roster)) expect(def.truth.roles.filter((r) => r === id).length).toBe(c);
    expect(def.inPlay).toEqual(def.truth.roles.filter((r) => ROLES[r].camp !== 'witness').sort());
  }
});

test('disguise faces come from witness roles in the roster', () => {
  for (let s = 0; s < 10; s++) {
    const def = generateValid(endlessParams(14), s);
    def.truth.roles.forEach((r, i) => {
      if (ROLES[r].camp === 'accomplice' || ROLES[r].camp === 'boss') expect(def.roster[def.faces[i]] ?? 0).toBeGreaterThan(0);
    });
  }
});

test('duplicate roles appear', () => {
  const p = { w: 3, h: 4, trouble: 0, accomplice: 2, boss: 1, pool: ['postman', 'pharmacist', 'grandma', 'dog', 'shill', 'chief'] };
  const def = generateValid(p, 1);
  expect(def.inPlay.filter((r) => r === 'shill').length).toBe(2);
});

test('boss count follows params', () => {
  const def = generateValid({ w: 4, h: 4, trouble: 0, accomplice: 1, boss: 2, pool: [...POOL, 'operator', 'priest'] }, 3);
  expect(def.truth.roles.filter((r) => ROLES[r].camp === 'boss').length).toBe(2);
});

test('endless generation is fast enough', () => { // Review Focus 1
  for (const n of [1, 10, 20, 30]) {
    const t = performance.now(); generateValid(endlessParams(n), n);
    expect(performance.now() - t).toBeLessThan(2000 * TIME_SCALE);
  }
});

test('endlessParams: n=1 start, n>=25 cap, monotone', () => {
  const p1 = endlessParams(1);
  expect([p1.w, p1.h, p1.accomplice, p1.trouble, p1.boss]).toEqual([3, 3, 0, 0, 1]);
  expect(p1.pool.every((id) => ROLES[id].tier === 1)).toBe(true);
  for (const n of [25, 40]) {
    const p = endlessParams(n);
    expect([p.w, p.h, p.trouble, p.accomplice, p.boss]).toEqual([4, 5, 3, 1, 3]);
    expect(p.pool.length).toBe(28);
  }
  for (let n = 2; n <= 30; n++) {
    const a = endlessParams(n - 1);
    const b = endlessParams(n);
    expect(b.w * b.h).toBeGreaterThanOrEqual(a.w * a.h);
    expect(b.accomplice + b.boss).toBeGreaterThanOrEqual(a.accomplice + a.boss);
    expect(b.trouble).toBeGreaterThanOrEqual(a.trouble);
    expect(b.boss).toBeGreaterThanOrEqual(a.boss);
    expect(b.pool.length).toBeGreaterThanOrEqual(a.pool.length);
  }
});
