// 시험 전용: 백트래킹 솔버와 전수 조사 솔버의 교차 검증.
// 판 수는 환경 변수 CROSS_CASES (기본 600). 3000판 전체는 npm run test:cross.
import { expect } from 'vitest';
import { solveBrute } from './brute';
import { makeRng, pick } from './rng';
import { solve, worldKey } from './solve';
import { normalize, randomInPlay, randomKnowledge, randomTruth } from './testcases';

// @types/node 없이 읽는다 (시험은 node 에서만 돈다)
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
export const CROSS_CASES = Number(env.CROSS_CASES ?? 600);

/** seed 7 흐름에서 [from, to) 번째 판만 두 솔버로 풀어 비교한다. 앞 판도 만들어 같은 난수 흐름을 쓴다. */
export function crossCheck(from: number, to: number): void {
  const r = makeRng(7);
  for (let t = 0; t < to; t++) {
    const [w, h] = pick(r, [[3, 3], [3, 4], [4, 3]] as const);
    const inPlay = randomInPlay(r, 4); // 말썽꾼 0~1, 공범 1~2, 주범 1, 최대 4
    const truth = randomTruth(r, w, h, inPlay);
    const k = randomKnowledge(r, truth, w, h);
    if (t < from) continue;
    const a = solve(k, Infinity).worlds.map(worldKey).sort(); // 상한 없이: 세계가 WORLD_CAP 을 넘는 판도 있다
    const b = solveBrute(k).map(worldKey).sort();
    expect(a, `seed-iter ${t}`).toEqual(b);
    expect(a).toContain(worldKey(normalize(truth, k))); // 실제 세계는 항상 들어 있다
  }
}
