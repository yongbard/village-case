import { expect, test } from 'vitest';
import { role } from './roles';
import { consistent } from './rules';
import { type CaseDef } from './types';
import { abilityCells, checkCase, fullKnowledge, signature } from './unique';

// 고정 사건 (시드 탐색으로 찾은 뒤 값을 그대로 적었다). 생성기에 의존하지 않는다.
const ev8 = (base: number, n: number) => ({ kind: 'evil8' as const, base, n });
const ev4 = (base: number, n: number) => ({ kind: 'evil4' as const, base, n });
const acc = (base: number, a: number) => ({ kind: 'accuse' as const, base, a });
const dir = (base: number, d: 'up' | 'down' | 'left' | 'right') => ({ kind: 'bossDir' as const, base, dir: d });

/**
 * 3×3, 두목(3번) + 망보기(6번). 망보기와 두목은 서로 붙어 있어 자리를 맞바꿔도 진술이 다 맞는다:
 * 주범이 3번인지 6번인지 갈리지 않는다.
 */
const BOSS_AMBIGUOUS: CaseDef = {
  seed: 3, w: 3, h: 3,
  truth: { roles: ['pharmacist', 'grandma', 'chief', 'postman', 'grandma', 'lookout', 'dog', 'dog', 'pharmacist'], taint: Array(9).fill(-1) },
  faces: ['pharmacist', 'grandma', 'grandma', 'postman', 'grandma', 'pharmacist', 'dog', 'dog', 'pharmacist'],
  clues: [ev8(0, 0), acc(1, 5), acc(2, 7), ev4(3, 0), acc(4, 2), ev8(5, 5), dir(6, 'up'), dir(7, 'right'), ev8(8, 1)],
  inPlay: ['chief', 'lookout'],
  roster: { pharmacist: 2, grandma: 2, chief: 1, postman: 1, lookout: 1, dog: 2 },
};

/**
 * 3×3, 망보기(2번) + 두목(6번). 개 주인 진술로 주범은 6번으로 정해지지만, 망보기 자리(2번)는
 * 5번일 수도 있어 선·악 배치는 하나가 아니다. 주범 자리만 하나면 된다.
 */
const BOSS_ONLY_UNIQUE: CaseDef = {
  seed: 821, w: 3, h: 3,
  truth: { roles: ['grandma', 'lookout', 'dog', 'grandma', 'postman', 'chief', 'grandma', 'grandma', 'dog'], taint: Array(9).fill(-1) },
  faces: ['grandma', 'postman', 'dog', 'grandma', 'postman', 'dog', 'grandma', 'grandma', 'dog'],
  clues: [acc(0, 5), ev4(1, 1), dir(2, 'down'), acc(3, 5), ev4(4, 2), dir(5, 'left'), acc(6, 5), acc(7, 5), dir(8, 'up')],
  inPlay: ['chief', 'lookout'],
  roster: { grandma: 4, lookout: 1, dog: 2, postman: 1, chief: 1 },
};

test('checkCase rejects when boss cell is ambiguous', () => {
  expect(consistent(fullKnowledge(BOSS_AMBIGUOUS), BOSS_AMBIGUOUS.truth)).toBe(true);
  expect(checkCase(BOSS_AMBIGUOUS)).toEqual({ ok: false, reason: 'ambiguous' });
});

test('checkCase accepts when only boss cells are unique', () => {
  expect(checkCase(BOSS_ONLY_UNIQUE)).toEqual({ ok: true, signature: '.....b...' });
});

test('truth that breaks its own rules is rejected (G3)', () => {
  // 오염원이 아닌 칸이 대상을 가진 불법 실제 세계
  const bad: CaseDef = { ...BOSS_ONLY_UNIQUE, truth: { ...BOSS_ONLY_UNIQUE.truth, taint: BOSS_ONLY_UNIQUE.truth.taint.map((t, i) => (i === 1 ? 4 : t)) } };
  expect(consistent(fullKnowledge(bad), bad.truth)).toBe(false);
  expect(checkCase(bad)).toEqual({ ok: false, reason: 'truthMismatch' });
});

test('signature marks boss cells only; fullKnowledge, abilityCells basics', () => {
  expect(signature({ roles: ['postman', 'braggart', 'thief', 'chief', 'decoy'], taint: [-1, -1, -1, -1, -1] })).toBe('...b.');
  const k = fullKnowledge(BOSS_ONLY_UNIQUE);
  expect(k.faces).toEqual(BOSS_ONLY_UNIQUE.faces);
  expect(k.clues).toEqual(BOSS_ONLY_UNIQUE.clues);
  expect(k.roster).toEqual(BOSS_ONLY_UNIQUE.roster);
  expect(k.abilities).toEqual([]);
  expect(k.arrested.every((a) => a === undefined)).toBe(true);
  expect(abilityCells(BOSS_ONLY_UNIQUE)).toEqual(BOSS_ONLY_UNIQUE.faces.flatMap((f, i) => (role(f).ability ? [i] : [])));
});
