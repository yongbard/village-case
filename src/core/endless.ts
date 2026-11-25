// 무한 모드 사건 고르기 (설계 docs/2026-11-25-endless-difficulty-design.md): 같은 시드에서 후보를 차례로 만들어
// 쉬운 사건(진술 몇 개로 답이 나오는 것)을 거른다. 같은 (n, 시드)는 어느 기기에서나 같은 사건이다(시간을 보지 않는다).
import { difficulty, explainWork, type Step } from './explain';
import { endlessParams, generateValid, trySeed } from './generate';
import { type CaseDef } from './types';
import { solvedKnowledge } from './unique';

/**
 * 후보 하나의 해설에 쓰는 일의 양 (2026-11-25 측정, logs/endless-probe/cells.txt·after-1500.txt): 이 PC 에서 대개 1초 안.
 * 사건 하나 고르는 데 n 마다 시드 20개 중 최대 2.7초(대부분은 4×5 주범 3 사건 생성 자체). 넘는 후보는 이유를 다 따지기 어려운 사건이라 기준을 넘은 것으로 친다
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

/** 고른 사건과, 기준을 넘었는지 (넘은 후보가 없으면 잰 것 중 가장 어려운 것) */
export function pickEndless(n: number, seed: number): { def: CaseDef; cleared: boolean } {
  const p = endlessParams(n);
  const cells = p.w * p.h;
  let best: { def: CaseDef; score: CaseScore } | null = null;
  for (let c = 0; c < CANDIDATES; c++) {
    const def = { ...generateValid(p, c === 0 ? seed : trySeed(seed, 1000 + c)), seed };
    const steps = explainWork(solvedKnowledge(def), WORK);
    if (steps === null) return { def, cleared: true };
    const score = caseScore(steps, cells);
    if (meetsFloor(score, cells)) return { def, cleared: true };
    if (!best || score.statementCells + score.difficulty > best.score.statementCells + best.score.difficulty) best = { def, score };
  }
  return { def: best!.def, cleared: false };
}

/** 무한 모드 n 번째 사건. 돌려주는 사건의 seed 는 받은 seed (사건 코드). */
export function generateEndless(n: number, seed: number): CaseDef {
  return pickEndless(n, seed).def;
}
