import { expect, test } from 'vitest';
import { describeStep, difficulty, explain, explainWithin, explainWork, nextHint, type Step } from './explain';
import { generateValid } from './generate';
import { claimHolds, campAt, consistent } from './rules';
import { ROLES } from './roles';
import { solve } from './solve';
import { investigate, knowledgeOf, newGame } from './game';
import { emptyKnowledgeOf, legacyEndlessParams, TIME_SCALE } from './testcases';
import { type CaseDef, type Claim, type Knowledge } from './types';
import { abilityCells, checkCase, fullKnowledge, solvedKnowledge } from './unique';

const holdsIn = (def: CaseDef, st: Step) => claimHolds(st.claim, campAt(def.truth, st.cell));
const bossCells = (def: CaseDef) => def.truth.roles.flatMap((_, i) => (campAt(def.truth, i) === 'boss' ? [i] : []));

/**
 * 손으로 만든 3×3: inPlay 길치·두목. 0번 길치(겉 직업 = 진짜, 참만 말함)가 "오른쪽 칸(1번) 기준 둘레 8칸에 악 0명"
 * → 0·2·3·4·5번(0부터)은 선. 5번 우체부(이웃 4칸 2·4·8 에 1명)로 주범은 8번으로 정해진다.
 */
const P = 'pharmacist';
const ONE_CLUE: CaseDef = Object.freeze({
  seed: 1, w: 3, h: 3,
  truth: { roles: ['lost', P, P, 'postman', P, 'postman', P, P, 'chief'], taint: Array(9).fill(-1) },
  faces: ['lost', P, P, 'postman', P, 'postman', P, P, P],
  clues: [
    { kind: 'evil8', base: 1, n: 0 }, null, null,
    { kind: 'evil4', base: 3, n: 0 }, null, { kind: 'evil4', base: 5, n: 1 },
    null, null, null,
  ],
  inPlay: ['chief', 'lost'],
  roster: { lost: 1, pharmacist: 5, postman: 2, chief: 1 },
}) as CaseDef;

/**
 * 시험 쪽 독립 확인: 겉 직업 + S 의 진술·능력 (+ withEarlier 면 앞 단계에서 정한 사실 전부) 만 남긴 관찰로 풀었을 때
 * 그 칸이 claim 이 아닌 세계가 없는가 (상한 없이 푼다)
 */
function proves(k: Knowledge, step: Step, earlier: Step[], withEarlier: boolean): boolean {
  if (step.because === 'all') return true;
  const n = k.w * k.h;
  const r: Knowledge = { ...k, clues: k.clues.map(() => null), abilities: [], knownClaims: Array(n).fill(undefined) };
  for (const f of step.because) {
    if (f.type === 'clue') r.clues[f.cell] = k.clues[f.cell];
    else r.abilities.push(k.abilities[f.index]);
  }
  if (withEarlier) for (const e of earlier) r.knownClaims![e.cell] = e.claim;
  return solve(r, Infinity).worlds.every((w) => claimHolds(step.claim, campAt(w, step.cell)));
}

test('one-clue case is a valid case', () => {
  expect(consistent(fullKnowledge(ONE_CLUE), ONE_CLUE.truth)).toBe(true);
  expect(checkCase(ONE_CLUE).ok).toBe(true);
});

test('one-clue deduction: faces first, then the clue, ending on the boss', () => {
  const steps = explain(fullKnowledge(ONE_CLUE));
  expect(steps[0]).toEqual({ cell: 0, claim: 'good', because: [], usesEarlier: false });
  const first = steps.find((st) => st.because !== 'all' && st.because.length > 0)!;
  expect(first.because).toEqual([{ type: 'clue', cell: 0 }]);
  expect(steps[steps.length - 1]).toMatchObject({ cell: 8, claim: 'boss' });
});

test('explain ends when every boss cell has a boss step', () => {
  for (const n of [3, 9, 14]) for (let s = 0; s < 5; s++) {
    const def = generateValid(legacyEndlessParams(n), 40 + s);
    const steps = explain(solvedKnowledge(def));
    for (const st of steps) expect(holdsIn(def, st)).toBe(true);
    const bossSteps = steps.filter((st) => st.claim === 'boss').map((st) => st.cell).sort((a, b) => a - b);
    expect(bossSteps).toEqual(bossCells(def));
    expect(steps[steps.length - 1].claim).toBe('boss');
    expect(new Set(steps.map((st) => st.cell)).size).toBe(steps.length);
  }
}, 120_000);

test('steps are proofs: each claim holds in every world', () => {
  for (const n of [3, 6, 9]) for (let s = 0; s < 6; s++) {
    const def = generateValid(legacyEndlessParams(n), 500 + s);
    const k = solvedKnowledge(def);
    const steps = explain(k);
    steps.forEach((st, i) => {
      expect(proves(k, st, steps.slice(0, i), true)).toBe(true);
      expect(proves(k, st, steps.slice(0, i), false)).toBe(!st.usesEarlier);
    });
    for (const st of steps) if (st.because !== 'all') expect(st.because.length).toBeLessThanOrEqual(3);
  }
}, 120_000);

test('two bosses: both get boss steps', () => {
  for (let s = 0; s < 4; s++) {
    const def = generateValid(legacyEndlessParams(12), 60 + s);
    expect(bossCells(def).length).toBe(2);
    const steps = explain(solvedKnowledge(def));
    expect(steps.filter((st) => st.claim === 'boss').map((st) => st.cell).sort((a, b) => a - b)).toEqual(bossCells(def));
  }
}, 60_000);

test('steps fixed by faces alone come first', () => {
  for (let s = 0; s < 6; s++) {
    const steps = explain(solvedKnowledge(generateValid(legacyEndlessParams(6), 7 + s)));
    const facesOnly = (st: Step) => st.because !== 'all' && st.because.length === 0 && !st.usesEarlier;
    const k = steps.filter(facesOnly).length;
    steps.forEach((st, i) => expect(facesOnly(st)).toBe(i < k));
  }
});

test('difficulty is 1..5 and grows with reason size', () => {
  const st = (because: Step['because']): Step => ({ cell: 0, claim: 'good', because, usesEarlier: false });
  const c = { type: 'clue' as const, cell: 0 };
  expect(difficulty(Array(9).fill(st([c])))).toBe(1);
  expect(difficulty(Array(9).fill(st('all')))).toBe(5);
  expect(difficulty([])).toBe(1);
  const d2 = difficulty(Array(9).fill(st([c, c])));
  const d3 = difficulty(Array(9).fill(st([c, c, c])));
  expect(d3).toBeGreaterThanOrEqual(d2);
  expect(5).toBeGreaterThanOrEqual(d3);
});

test('difficulty ignores steps that need no statement (faces and roster alone)', () => {
  const st = (because: Step['because'], usesEarlier = false): Step => ({ cell: 0, claim: 'good', because, usesEarlier });
  const c = { type: 'clue' as const, cell: 0 };
  const hard = [st([c, c, c]), st([c, c])];
  expect(difficulty([...Array(9).fill(st([])), st([], true), ...hard])).toBe(difficulty(hard));
});

test('describeStep reads like a deduction', () => {
  const def = ONE_CLUE;
  const d = (cell: number, claim: Claim, because: Step['because'], usesEarlier = false) =>
    describeStep({ cell, claim, because, usesEarlier }, def);
  const c3 = { type: 'clue' as const, cell: 3 };
  const c5 = { type: 'clue' as const, cell: 5 };
  expect(d(0, 'good', [])).toBe('1번은 선: 겉 직업이 말썽꾼(길치)이다.');
  expect(d(8, 'boss', [], true)).toBe('9번은 주범: 앞에서 정한 것만으로 정해진다.');
  expect(d(2, 'good', [{ type: 'clue', cell: 0 }])).toBe('3번은 선: 1번 길치의 진술만 보아도 다른 경우는 맞지 않는다.');
  expect(d(6, 'evil', [c3, c5])).toBe('7번은 악: 4번 우체부와 6번 우체부의 진술을 함께 보면 다른 경우는 맞지 않는다.');
  expect(d(1, 'notBoss', [c3], true)).toBe('2번은 주범이 아님: 앞에서 정한 것과 4번 우체부의 진술을 함께 보면 다른 경우는 맞지 않는다.');
  expect(d(6, 'accomplice', [c3, c5], true)).toBe('7번은 공범: 앞에서 정한 것, 4번 우체부와 6번 우체부의 진술을 함께 보면 다른 경우는 맞지 않는다.');
  expect(d(7, 'boss', 'all')).toBe('8번은 주범: 모든 경우를 따져 보면 이렇게만 맞는다.');
});

test('hint asks to investigate when nothing is investigated', () => {
  const def = generateValid(legacyEndlessParams(20), 3);
  expect(nextHint(emptyKnowledgeOf(def))).toEqual({ kind: 'investigate', cell: 0 });
});

test('hint never throws on capped knowledge', () => {
  const def = generateValid(legacyEndlessParams(30), 4);
  expect(() => nextHint(emptyKnowledgeOf(def))).not.toThrow();
});

test('hint on full knowledge is the first explain step', () => {
  const k = fullKnowledge(ONE_CLUE);
  expect(nextHint(k)).toEqual({ kind: 'step', step: explain(k)[0] });
});

test('nextHint never points at an arrested cell', () => {
  const def = ONE_CLUE;
  let g = newGame(def);
  for (let i = 0; i < 9; i++) g = investigate(g, i);
  const k = knowledgeOf(g);
  k.arrested[0] = 'lost';
  const h = nextHint(k);
  expect(h.kind).toBe('step');
  if (h.kind === 'step') expect(h.step.cell).not.toBe(0);
});

test('hint points to an unused ability when nothing is left to investigate or deduce', () => {
  let def: CaseDef | undefined;
  for (let s = 0; !def || abilityCells(def).length === 0; s++) def = generateValid(legacyEndlessParams(14), s);
  const cells = abilityCells(def);
  const k = fullKnowledge(def);
  k.knownClaims = Array(def.w * def.h).fill(undefined);
  for (const st of explain(k)) k.knownClaims[st.cell] = st.claim;
  const h = nextHint(k);
  if (h.kind !== 'step') expect(h).toEqual({ kind: 'ability', cell: cells[0] });
}, 60_000);

test('explain on 4x4 finishes under 3s and ends on the bosses', () => {
  for (const [n, s] of [[14, 0], [16, 1], [17, 2]]) {
    const def = generateValid(legacyEndlessParams(n), s);
    expect(def.w * def.h).toBe(16);
    const t0 = performance.now();
    const steps = explain(solvedKnowledge(def));
    expect(performance.now() - t0).toBeLessThan(3000 * TIME_SCALE);
    for (const st of steps) expect(holdsIn(def, st)).toBe(true);
    expect(steps.filter((st) => st.claim === 'boss').length).toBe(bossCells(def).length);
  }
}, 60_000);

// 힌트를 거듭 눌러도 같은 칸에 머물지 않는다: 앞 힌트의 답을 알던 사실로 넘기면 다음 힌트는 늘 새 칸이고,
// 그 이유는 앞 힌트들(+ usesEarlier 가 아니면 이유만)으로 정말 증명된다
test('repeated hints with fed-back answers name new cells until the bosses are known', () => {
  for (const [n, s] of [[9, 1], [12, 2], [20, 3]]) {
    const def = generateValid(legacyEndlessParams(n), s);
    const cells = def.w * def.h;
    const k = solvedKnowledge(def);
    k.knownClaims = Array(cells).fill(undefined);
    const given: Step[] = [];
    for (;;) {
      const h = nextHint(k);
      if (h.kind !== 'step') break;
      const st = h.step;
      expect(k.knownClaims[st.cell], `n${n} cell ${st.cell} repeated`).toBeUndefined();
      expect(holdsIn(def, st)).toBe(true);
      if (cells <= 12) {
        expect(proves(k, st, given, true)).toBe(true);
        expect(proves(k, st, given, false)).toBe(!st.usesEarlier);
      }
      given.push(st);
      k.knownClaims[st.cell] = st.claim;
      expect(given.length).toBeLessThanOrEqual(cells);
    }
    expect(given.filter((st) => st.claim === 'boss').map((st) => st.cell).sort((a, b) => a - b)).toEqual(bossCells(def));
  }
}, 120_000);

test('hint on partial knowledge stays within its time budget and is sound', () => {
  const def = generateValid(legacyEndlessParams(30), 11);
  for (const skip of [[2, 4, 5, 6, 19], [0, 7, 11, 15, 16]]) {
    let g = newGame(def);
    for (let c = 0; c < 20; c++) if (!skip.includes(c)) g = investigate(g, c);
    const k = knowledgeOf(g);
    const t0 = performance.now();
    const h = nextHint(k);
    expect(performance.now() - t0).toBeLessThan(2500 * TIME_SCALE);
    if (h.kind === 'step') expect(holdsIn(def, h.step)).toBe(true);
    else if (h.kind === 'investigate') expect(skip).toContain(h.cell);
  }
}, 60_000);

test('hint with an exhausted budget never returns an unproven step', () => {
  for (const [n, s] of [[9, 5], [20, 6], [30, 7]]) {
    const def = generateValid(legacyEndlessParams(n), s);
    const h = nextHint(fullKnowledge(def), 0);
    if (h.kind === 'step') {
      expect(h.step.because).toBe('all');
      expect(holdsIn(def, h.step)).toBe(true);
    }
  }
});

test('explainWithin: null when the budget runs out, same as explain otherwise', () => {
  const def = generateValid(legacyEndlessParams(14), 3);
  const k = solvedKnowledge(def);
  expect(explainWithin(k, 0)).toBeNull();
  expect(explainWithin(k, 60_000)).toEqual(explain(k));
}, 60_000);

// 일의 양 한도: 기기 속도와 상관없이 같은 입력이면 같은 곳에서 멈춘다 (무한 모드 사건 고르기)
const smallPool = Object.values(ROLES).filter((r) => r.tier <= 2).map((r) => r.id);
const smallCase = () => generateValid({ w: 3, h: 4, trouble: 1, accomplice: 1, boss: 1, pool: smallPool }, 5);

test('explainWork with enough work equals explain', () => {
  const k = solvedKnowledge(smallCase());
  expect(explainWork(k, 1e9)).toEqual(explain(k));
});

test('explainWork with tiny work gives up', () => {
  expect(explainWork(solvedKnowledge(smallCase()), 1)).toBeNull();
});

test('explainWork is deterministic: the least work that finishes is the same every time', () => {
  const k = solvedKnowledge(generateValid({ w: 4, h: 4, trouble: 1, accomplice: 2, boss: 2, pool: smallPool }, 8));
  const least = () => {
    let w = 1;
    while (explainWork(k, w) === null) w *= 2;
    return w;
  };
  const a = least();
  expect(a).toBeGreaterThan(1);
  expect(least()).toBe(a);
  expect(explainWork(k, a)).toEqual(explain(k));
});

test('a small work limit is also a short time, even when most time is in consistency checks', () => {
  // 4×5 주범 3: 시간 대부분이 세계마다의 consistent 검사라 탐색 걸음만 세면 한도 1000 에도 10초가 걸렸다
  const all = Object.values(ROLES).map((r) => r.id);
  const k = solvedKnowledge(generateValid({ w: 4, h: 5, trouble: 3, accomplice: 1, boss: 3, pool: all }, 9648));
  const t0 = performance.now();
  explainWork(k, 1000);
  expect(performance.now() - t0).toBeLessThan(1500 * TIME_SCALE);
});
