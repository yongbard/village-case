// 무한 모드 사건 고르기 (설계 docs/2026-11-25-endless-difficulty-design.md): 같은 시드에서 후보를 차례로 만들어
// 쉬운 사건(진술 몇 개로 답이 나오는 것)을 거른다. 같은 (n, 시드)는 어느 기기에서나 같은 사건이다(시간을 보지 않는다).
import { difficulty, explainBudget, type Step } from './explain';
import { endlessParams, generateValid, trySeed } from './generate';
import { type CaseDef } from './types';
import { solvedKnowledgeWithin } from './unique';

/**
 * 후보 하나의 능력 관찰 찾기 + 해설에 쓰는 일의 양 (2026-11-25 측정, logs/endless-probe/cells.txt·after-100.txt).
 * 일의 양은 시간과 대략만 비례한다. 사건 하나 고르기는 n 마다 시드 100개에서 중앙값 0.1 ~ 0.8초, p95 2.2초,
 * 최대 3.5초(가장 느린 것은 4×5 주범 3 사건 생성 자체, 시드 70020 은 4.9초).
 * 이 값·CANDIDATES·기준을 바꾸면 사건 코드가 다른 사건이 된다 (endless.test 의 고정 시험). 넘는 후보는 이유를 다 따지기 어려운 사건이라 기준을 넘은 것으로 친다
 * (넘은 후보 23개 중 21개가 난이도 3 이상이었다).
 */
const WORK = 1500;
/** 후보 수. 4×4 주범 1 은 후보 하나가 기준을 넘을 확률이 35% 쯤이라 12개면 못 찾는 일이 1% 아래다. */
const CANDIDATES = 12;
/** 필요한 진술 칸이 판의 이만큼 이상 (4×4 면 6칸, 4×5 면 7칸): "3명쯤 조사해서 답이 나오는" 사건을 거른다 */
const MIN_CELL_SHARE = 0.35;
/** 난이도 1(이유가 모두 진술 하나)은 거른다 */
const MIN_DIFFICULTY = 2;

export interface CaseScore {
  difficulty: number;
  /** 해설 이유에 나온 진술 칸 수 (겹침 빼고). 'all' 단계가 있으면 판 전체 */
  statementCells: number;
}

export function caseScore(steps: Step[], cells: number): CaseScore {
  const used = new Set<number>();
  for (const s of steps) {
    if (s.because === 'all') return { difficulty: difficulty(steps), statementCells: cells };
    for (const f of s.because) if (f.type === 'clue') used.add(f.cell);
  }
  return { difficulty: difficulty(steps), statementCells: used.size };
}

export function meetsFloor(s: CaseScore, cells: number): boolean {
  return s.difficulty >= MIN_DIFFICULTY && s.statementCells >= Math.ceil(cells * MIN_CELL_SHARE);
}

/**
 * 고른 사건과 고른 까닭. candidate 는 몇 번째 후보인지, how 는 기준을 넘음(floor)·한도를 넘음(over)·
 * 넘은 후보가 없어 잰 것 중 가장 어려운 것(best).
 */
export interface Pick {
  def: CaseDef;
  cleared: boolean;
  candidate: number;
  how: 'floor' | 'over' | 'best';
}

export function pickEndless(n: number, seed: number): Pick {
  const p = endlessParams(n);
  const cells = p.w * p.h;
  let best: { def: CaseDef; score: CaseScore; c: number } | null = null;
  for (let c = 0; c < CANDIDATES; c++) {
    const def = { ...generateValid(p, c === 0 ? seed : trySeed(seed, 1000 + c)), seed };
    // 능력 관찰 찾기와 해설이 한 한도를 나눠 쓴다. 넘으면 다 따지기 어려운 사건이라 기준을 넘은 것으로 친다.
    const budget = { deadline: Infinity, expired: false, work: WORK };
    const k = solvedKnowledgeWithin(def, budget);
    const steps = k && explainBudget(k, budget);
    if (!steps) return { def, cleared: true, candidate: c, how: 'over' };
    const score = caseScore(steps, cells);
    if (meetsFloor(score, cells)) return { def, cleared: true, candidate: c, how: 'floor' };
    if (!best || score.statementCells + score.difficulty > best.score.statementCells + best.score.difficulty) best = { def, score, c };
  }
  return { def: best!.def, cleared: false, candidate: best!.c, how: 'best' };
}

/** 무한 모드 n 번째 사건. 돌려주는 사건의 seed 는 받은 seed (사건 코드). */
export function generateEndless(n: number, seed: number): CaseDef {
  return pickEndless(n, seed).def;
}
