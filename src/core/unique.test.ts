import { expect, test } from 'vitest';
import { role } from './roles';
import { consistent } from './rules';
import { type CaseDef } from './types';
import { abilityCells, checkCase, fullKnowledge, signature } from './unique';

// 고정 사건 (시드 탐색으로 찾은 뒤 값을 그대로 적었다). 생성기에 의존하지 않는다.
const P = 'pharmacist';
const e8 = (base: number, n: number) => ({ kind: 'evil8' as const, base, n });
const row = (base: number, n: number) => ({ kind: 'evilRow' as const, base, n });

/**
 * 3×3, 좀도둑 + 두목, 모두 약사로 보인다. 실제(악 = 2·7번)와 다른 배치(악 = 3·4번)도
 * 모든 진술과 맞는다 (두 배치 모두 거짓말쟁이가 둘이고 나머지 진술이 다 참).
 */
const AMBIGUOUS: CaseDef = {
  seed: 50, w: 3, h: 3,
  truth: { roles: [P, 'thief', P, P, P, P, 'chief', P, P], taint: Array(9).fill(-1) },
  faces: Array(9).fill(P),
  clues: [e8(0, 1), e8(1, 2), e8(2, 1), e8(3, 2), e8(4, 2), e8(5, 1), e8(6, 1), e8(7, 1), e8(8, 0)],
  inPlay: ['thief', 'chief'],
};

/**
 * 3×3, 좀도둑 + 두목, 5번이 진짜 기자. 3번이 악인 것은 진술로 정해지지만, 남은 악이
 * 8번(두목, 이장으로 보임)인지 9번(약사로 보임)인지는 진술만으로 갈리지 않는다(둘 다 모든 진술과 맞는다).
 * 기자 능력으로 3번과 8번이 같은 편인지 물으면 두 경우의 답이 달라 정해진다.
 */
const NEEDS_REPORTER: CaseDef = {
  seed: 9, w: 3, h: 3,
  truth: {
    roles: ['mayor', 'mayor', 'thief', 'mayor', 'reporter', P, 'mayor', 'chief', P],
    taint: Array(9).fill(-1),
  },
  faces: ['mayor', 'mayor', P, 'mayor', 'reporter', P, 'mayor', 'mayor', P],
  clues: [row(0, 1), row(1, 1), e8(2, 2), row(3, 0), null, e8(5, 2), row(6, 1), row(7, 1), e8(8, 1)],
  inPlay: ['thief', 'chief'],
};

/**
 * 같은 사건에서 능력만 뺀 것: 기자 겉 직업 칸을 진술이 보이지 않는 약사로 바꾼다(진짜 기자였으면
 * 진짜 직업도 약사로). 기자는 원래 진술이 없으므로 관찰 정보는 그대로이고 능력만 사라진다.
 * 진술을 새로 주면 정보가 늘어 시험의 뜻이 흐려지므로 null 로 둔다.
 */
function withoutReporter(def: CaseDef): CaseDef {
  const swap = (id: string) => (role(id).ability ? P : id);
  return {
    ...def,
    truth: { ...def.truth, roles: def.truth.roles.map(swap) },
    faces: def.faces.map(swap),
    clues: def.clues.map((c, i) => (role(def.faces[i]).ability ? null : c)),
  };
}

test('hand-made ambiguous case is rejected', () => {
  expect(consistent(fullKnowledge(AMBIGUOUS), AMBIGUOUS.truth)).toBe(true);
  expect(checkCase(AMBIGUOUS)).toEqual({ ok: false, reason: 'ambiguous' });
});

test('case that needs the reporter is accepted only with the ability', () => {
  expect(abilityCells(NEEDS_REPORTER)).toEqual([4]);
  expect(consistent(fullKnowledge(NEEDS_REPORTER), NEEDS_REPORTER.truth)).toBe(true);
  expect(checkCase(NEEDS_REPORTER)).toEqual({ ok: true, signature: 'ggeggggeg' });
  expect(abilityCells(withoutReporter(NEEDS_REPORTER))).toEqual([]);
  expect(checkCase(withoutReporter(NEEDS_REPORTER))).toEqual({ ok: false, reason: 'ambiguous' });
});

test('signature, fullKnowledge, abilityCells basics', () => {
  expect(signature({ roles: ['postman', 'braggart', 'thief', 'chief'], taint: [-1, -1, -1, -1] })).toBe('ggee');
  const k = fullKnowledge(NEEDS_REPORTER);
  expect(k.faces).toEqual(NEEDS_REPORTER.faces);
  expect(k.clues).toEqual(NEEDS_REPORTER.clues);
  expect(k.abilities).toEqual([]);
  expect(k.arrested.every((a) => a === undefined)).toBe(true);
  expect(abilityCells(NEEDS_REPORTER)).toEqual(
    NEEDS_REPORTER.faces.flatMap((f, i) => (role(f).ability ? [i] : [])),
  );
});
