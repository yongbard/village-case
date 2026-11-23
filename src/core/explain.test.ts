import { expect, test } from 'vitest';
import { describeStep, difficulty, explain, nextHint, type Step } from './explain';
import { endlessParams, generateValid } from './generate';
import { isEvil } from './roles';
import { campAt, consistent } from './rules';
import { solve } from './solve';
import { emptyKnowledgeOf } from './testcases';
import { type CaseDef, type Knowledge, type Side } from './types';
import { abilityCells, checkCase, fullKnowledge, solvedKnowledge } from './unique';

const sideOf = (def: CaseDef, i: number): Side => (isEvil(campAt(def.truth, i)) ? 'evil' : 'good');

/**
 * 손으로 만든 3×3: inPlay 길치·좀도둑·두목. 0번 길치(겉 직업 = 진짜, 참만 말함)가
 * "오른쪽 칸(2번) 기준 둘레 8칸에 악 0명" → 1·3·4·5·6번(0부터)은 선. 3번 우체부(이웃 4칸에 1명)와
 * 5번 우체부(이웃 4칸에 1명)로 악은 6·8번으로 정해진다. 나머지 칸은 진술 없는 증인 겉 직업.
 */
const P = 'pharmacist';
const ONE_CLUE: CaseDef = Object.freeze({
  seed: 1, w: 3, h: 3,
  truth: { roles: ['lost', P, P, 'postman', P, 'postman', 'thief', P, 'chief'], taint: Array(9).fill(-1) },
  faces: ['lost', P, P, 'postman', P, 'postman', P, P, P],
  clues: [
    { kind: 'evil8', base: 1, n: 0 }, null, null,
    { kind: 'evil4', base: 3, n: 1 }, null, { kind: 'evil4', base: 5, n: 1 },
    null, null, null,
  ],
  inPlay: ['lost', 'thief', 'chief'],
}) as CaseDef;

/**
 * 시험 쪽 독립 확인: 겉 직업 + S 의 진술·능력 (+ withEarlier 면 앞 단계에서 정한 선·악 전부) 만 남긴 관찰로 풀었을 때
 * 그 칸이 반대편인 세계가 없는가 (상한 없이 푼다)
 */
function proves(k: Knowledge, step: Step, earlier: Step[], withEarlier: boolean): boolean {
  if (step.because === 'all') return true;
  const r: Knowledge = {
    ...k,
    clues: k.clues.map(() => null),
    abilities: [],
    knownSides: Array(k.w * k.h).fill(undefined),
  };
  for (const f of step.because) {
    if (f.type === 'clue') r.clues[f.cell] = k.clues[f.cell];
    else r.abilities.push(k.abilities[f.index]);
  }
  if (withEarlier) for (const e of earlier) r.knownSides![e.cell] = e.side;
  r.knownSides![step.cell] = step.side === 'good' ? 'evil' : 'good';
  const res = solve(r, 1);
  return res.worlds.length === 0;
}

// 능력(기자) 칸이 있는 사건은 다 조사해도 선·악이 하나로 안 정해지므로(G2), 능력을 실제 답으로 쓴 관찰로 푼다
test('explain covers every cell and matches truth', () => {
  for (let s = 0; s < 20; s++) {
    const def = generateValid(endlessParams(8), s);
    const steps = explain(solvedKnowledge(def));
    expect(new Set(steps.map((x) => x.cell)).size).toBe(def.w * def.h);
    for (const st of steps) expect(st.side).toBe(sideOf(def, st.cell));
  }
}, 60_000);

test('one-clue case is a valid case', () => {
  expect(consistent(fullKnowledge(ONE_CLUE), ONE_CLUE.truth)).toBe(true);
  expect(checkCase(ONE_CLUE).ok).toBe(true);
});

test('one-clue deduction has reason size 1', () => {
  const steps = explain(fullKnowledge(ONE_CLUE));
  // 겉 직업만으로 정해지는 칸(0번 길치)이 먼저, 이유는 빈 목록
  expect(steps[0]).toEqual({ cell: 0, side: 'good', because: [], usesEarlier: false });
  const first = steps.find((st) => st.because !== 'all' && st.because.length > 0)!;
  expect([2, 3, 4, 5]).toContain(first.cell);
  expect(first.because).toEqual([{ type: 'clue', cell: 0 }]);
});

test('every reason really proves its step (small boards)', () => {
  for (const n of [3, 6, 9]) for (let s = 0; s < 6; s++) {
    const def = generateValid(endlessParams(n), 500 + s);
    const k = solvedKnowledge(def);
    const steps = explain(k);
    steps.forEach((st, i) => {
      // 앞 단계까지 알면 증명되고, usesEarlier 가 아니면 S 만으로도 증명된다
      expect(proves(k, st, steps.slice(0, i), true)).toBe(true);
      expect(proves(k, st, steps.slice(0, i), false)).toBe(!st.usesEarlier);
    });
    // 이유 크기는 줄지 않는 순서가 아니어도 되지만, 'all' 이 아닌 이유는 3개 이하
    for (const st of steps) if (st.because !== 'all') expect(st.because.length).toBeLessThanOrEqual(3);
  }
}, 120_000);

test('steps fixed by faces alone come first', () => {
  for (let s = 0; s < 6; s++) {
    const steps = explain(solvedKnowledge(generateValid(endlessParams(6), 7 + s)));
    const facesOnly = (st: Step) => st.because !== 'all' && st.because.length === 0 && !st.usesEarlier;
    const k = steps.filter(facesOnly).length;
    steps.forEach((st, i) => expect(facesOnly(st)).toBe(i < k));
  }
});

test('difficulty is 1..5 and grows with reason size', () => {
  const st = (because: Step['because']): Step => ({ cell: 0, side: 'good', because, usesEarlier: false });
  const c = { type: 'clue' as const, cell: 0 };
  expect(difficulty(Array(9).fill(st([c])))).toBe(1);
  expect(difficulty(Array(9).fill(st('all')))).toBe(5);
  expect(difficulty([])).toBe(1);
  const d2 = difficulty(Array(9).fill(st([c, c])));
  const d3 = difficulty(Array(9).fill(st([c, c, c])));
  expect(d2).toBeGreaterThanOrEqual(1);
  expect(d3).toBeGreaterThanOrEqual(d2);
  expect(5).toBeGreaterThanOrEqual(d3);
});

test('difficulty: early endless cases easy, late ones hard', () => {
  const score = (n: number, s: number) => {
    const def = generateValid(endlessParams(n), s);
    return difficulty(explain(solvedKnowledge(def)));
  };
  for (let s = 0; s < 4; s++) expect(score(1, s)).toBeLessThanOrEqual(2);
  for (let s = 0; s < 2; s++) expect(score(30, s)).toBeGreaterThanOrEqual(3);
}, 60_000);

test('describeStep reads like a deduction', () => {
  const def = ONE_CLUE;
  const d = (cell: number, side: Step['side'], because: Step['because'], usesEarlier = false) =>
    describeStep({ cell, side, because, usesEarlier }, def);
  const c3 = { type: 'clue' as const, cell: 3 };
  const c5 = { type: 'clue' as const, cell: 5 };
  expect(d(0, 'good', [])).toBe('1번은 선: 겉 직업이 말썽꾼(길치)이다.');
  expect(d(8, 'evil', [], true)).toBe('9번은 악: 앞에서 정한 것만으로 정해진다.');
  expect(d(2, 'good', [{ type: 'clue', cell: 0 }])).toBe('3번은 선: 1번 길치의 진술만 보아도 악일 수 없다.');
  expect(d(6, 'evil', [c3, c5])).toBe('7번은 악: 4번 우체부와 6번 우체부의 진술을 함께 보면 선일 수 없다.');
  expect(d(1, 'good', [c3], true)).toBe('2번은 선: 앞에서 정한 것과 4번 우체부의 진술을 함께 보면 악일 수 없다.');
  expect(d(6, 'evil', [c3, c5], true)).toBe('7번은 악: 앞에서 정한 것, 4번 우체부와 6번 우체부의 진술을 함께 보면 선일 수 없다.');
  expect(d(7, 'evil', 'all')).toBe('8번은 악: 모든 경우를 따져 보면 이렇게만 맞는다.');
});

test('hint asks to investigate when nothing is investigated', () => {
  const def = generateValid(endlessParams(20), 3);
  expect(nextHint(emptyKnowledgeOf(def))).toEqual({ kind: 'investigate', cell: 0 });
});

test('hint never throws on capped knowledge', () => {
  const def = generateValid(endlessParams(30), 4);
  expect(() => nextHint(emptyKnowledgeOf(def))).not.toThrow();
});

test('hint on full knowledge is the first explain step', () => {
  const k = fullKnowledge(ONE_CLUE);
  expect(nextHint(k)).toEqual({ kind: 'step', step: explain(k)[0] });
});

test('hint skips investigated cells', () => {
  const def = generateValid(endlessParams(20), 3);
  const k = emptyKnowledgeOf(def);
  k.faces[0] = def.faces[0];
  k.clues[0] = def.clues[0];
  const h = nextHint(k);
  if (h.kind === 'investigate') expect(h.cell).toBe(1);
  else if (h.kind === 'step') expect(h.step.side).toBe(sideOf(def, h.step.cell));
});

test('hint points to an unused ability when nothing is left to investigate or deduce', () => {
  // 기자 겉 직업이 있는 사건: 다 조사하고, 진술로 정해지는 칸은 이미 안다고 두면 남은 일은 능력뿐
  const def = generateValid(endlessParams(8), 0);
  const cells = abilityCells(def);
  expect(cells.length).toBeGreaterThan(0);
  const k = fullKnowledge(def);
  k.knownSides = Array(def.w * def.h).fill(undefined);
  for (const st of explain(k)) k.knownSides[st.cell] = st.side;
  expect(nextHint(k)).toEqual({ kind: 'ability', cell: cells[0] });
  // 그 능력을 썼으면 다음 능력 칸
  k.abilities.push({ cell: cells[0], a: 0, b: 1, same: true });
  const h = nextHint(k);
  if (cells.length > 1 && h.kind === 'ability') expect(h.cell).toBe(cells[1]);
});

test('explain on 4x4 finishes under 3s', () => {
  for (const [n, s] of [[14, 0], [16, 1], [17, 2]]) {
    const def = generateValid(endlessParams(n), s);
    expect(def.w * def.h).toBe(16);
    const t0 = performance.now();
    const steps = explain(fullKnowledge(def));
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(3000);
    for (const st of steps) expect(st.side).toBe(sideOf(def, st.cell));
    if (abilityCells(def).length === 0) expect(steps.length).toBe(16);
  }
}, 60_000);
