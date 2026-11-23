// 시험 전용: 백트래킹 솔버와 전수 조사 솔버의 교차 검증.
// seed 7 로 만든 3000판을 여러 시험 파일이 나눠 돈다(파일끼리 병렬로 돌아 시간이 줄어든다).
import { expect } from 'vitest';
import { solveBrute } from './brute';
import { makeRng, pick } from './rng';
import { solve, worldKey } from './solve';
import { normalize, randomInPlay, randomKnowledge, randomTruth } from './testcases';

export const CROSS_CASES = 3000;
/** 교차 검증을 나눠 도는 시험 파일 수 (solve.test.ts + solve.cross2~6.test.ts) */
export const CROSS_SLICES = 6;

/** s 번째(1부터) 조각을 돈다 */
export function crossCheckSlice(s: number): void {
  crossCheck((CROSS_CASES * (s - 1)) / CROSS_SLICES, (CROSS_CASES * s) / CROSS_SLICES);
}

/** 3000판 흐름에서 [from, to) 번째 판만 두 솔버로 풀어 비교한다. 앞 판도 만들어 같은 난수 흐름을 쓴다. */
export function crossCheck(from: number, to: number): void {
  const r = makeRng(7);
  for (let t = 0; t < to; t++) {
    const [w, h] = pick(r, [[3, 3], [3, 4], [4, 3]] as const);
    const inPlay = randomInPlay(r, 4); // 말썽꾼 0~1, 공범 1~2, 주범 1, 최대 4
    const truth = randomTruth(r, w, h, inPlay);
    const k = randomKnowledge(r, truth, w, h);
    if (t < from) continue;
    const a = solve(k).worlds.map(worldKey).sort();
    const b = solveBrute(k).map(worldKey).sort();
    expect(a, `seed-iter ${t}`).toEqual(b);
    expect(a).toContain(worldKey(normalize(truth, k))); // 실제 세계는 항상 들어 있다
  }
}
