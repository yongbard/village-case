// 스테이지 30개를 만들어 src/content/stages.json 에 쓴다 (npm run stages).
// 장 j 의 k번째 스테이지마다 고정 시드로 후보를 여럿 만들고 난이도를 잰 뒤,
// 장 안에서 난이도가 줄지 않으면서 목표 난이도에 가장 가깝게 고른다. 한 프로세스에서 차례로 돈다.
import { CHAPTERS, chapterOf, chapterPrefix, rolesFor, type Chapter, type Stage } from '../content/chapters';
import { difficulty, explain, type Step } from '../core/explain';
import { generateValid, type GenParams } from '../core/generate';
import { role } from '../core/roles';
import { type AbilityObs, type CaseDef, type RoleId } from '../core/types';
import { solvedKnowledge } from '../core/unique';

// @types/node 없이 쓴다 (이 스크립트는 node 에서만 돈다)
const { writeFileSync } = (await import('node:fs' as string)) as { writeFileSync(path: URL, data: string): void };
const OUT = new URL('../content/stages.json', import.meta.url);

/** 스테이지당 후보 수 (4×5 는 후보 하나에 1초 안팎, 전체 빌드 2분쯤) */
const CANDIDATES = 40;
/** 장마다 목표 난이도 [첫 스테이지, 끝 스테이지]. 사이는 고르게 올린다. */
const TARGET: Record<number, [number, number]> = { 1: [1, 2], 2: [1, 3], 3: [2, 3], 4: [2, 4], 5: [3, 4], 6: [3, 5] };
/** 이 장의 난이도 하한. 아래는 큰 벌점이라, 넘는 후보가 없을 때만 하한에 가장 가까운(가장 어려운) 후보를 쓴다. */
const FLOOR: Record<number, number> = { 6: 3 };
/** 새 증인 직업의 뽑기 가중치 배수 */
const NEW_WITNESS_WEIGHT = 3;

/** 장 j 의 k번째 스테이지: [말썽꾼 수, 공범 수] 기본값 */
function counts(j: number, k: number): [number, number] {
  switch (j) {
    case 1: return [0, 1];
    case 2: return [k < 4 ? 0 : 1, 1];
    case 3: return [1, k < 4 ? 1 : 2];
    case 4: return [k < 4 ? 1 : 2, 2];
    case 5: return [2, 2];
    default: return [k < 4 ? 2 : 3, k < 3 ? 2 : 3];
  }
}

function stageParams(id: number): GenParams {
  const { chapter, k } = chapterOf(id);
  const j = chapter.no;
  const pool = rolesFor(id);
  const prefix = chapterPrefix(id);
  // 말썽꾼·악만 must. 주범은 한 사건에 한 명이라 가장 늦게 들어온 주범만 둔다.
  let must = prefix.filter((id) => role(id).camp !== 'witness');
  const bosses = must.filter((id) => role(id).camp === 'boss');
  must = must.filter((id) => role(id).camp !== 'boss' || id === bosses[bosses.length - 1]);
  const weights: Partial<Record<RoleId, number>> = {};
  for (const id of prefix) if (role(id).camp === 'witness') weights[id] = NEW_WITNESS_WEIGHT;
  const [w, h] = chapter.sizes[Math.floor(((k - 1) * chapter.sizes.length) / 5)];
  const avail = (camp: string) => pool.filter((id) => role(id).camp === camp).length;
  const mustOf = (camp: string) => must.filter((id) => role(id).camp === camp).length;
  const [t, a] = counts(j, k);
  return {
    w, h, pool, must, weights,
    boss: 1, // 작업 8 에서 장별 주범 수로
    trouble: Math.min(Math.max(t, mustOf('trouble')), avail('trouble')),
    accomplice: Math.min(Math.max(a, mustOf('accomplice')), avail('accomplice')),
  };
}

interface Cand {
  def: CaseDef;
  abilities: AbilityObs[];
  steps: Step[];
  difficulty: number;
}

function candidates(id: number): Cand[] {
  const p = stageParams(id);
  const out: Cand[] = [];
  for (let c = 0; c < CANDIDATES; c++) {
    const def = generateValid(p, id * 1000 + c, 5000);
    const k = solvedKnowledge(def);
    const steps = explain(k);
    out.push({ def, abilities: k.abilities, steps, difficulty: difficulty(steps) });
  }
  return out;
}

/**
 * 장 하나: 스테이지마다 후보 목록에서 하나씩, 난이도가 줄지 않게 고른다.
 * 비용 = 목표와의 차이 합 (+ 하한 아래면 크게). 같은 난이도면 앞 시드 후보.
 */
function pickChapter(ch: Chapter, cands: Cand[][]): Cand[] {
  const [lo, hi] = TARGET[ch.no];
  const floor = FLOOR[ch.no] ?? 1;
  const D = [1, 2, 3, 4, 5];
  const cost = (k: number, d: number) => Math.abs(d - (lo + ((hi - lo) * k) / 4)) + (d < floor ? 100 : 0);
  // best[k][d] = 스테이지 0..k 를 고르고 k 가 난이도 d 일 때 최소 비용
  const best: number[][] = [];
  const from: number[][] = [];
  cands.forEach((cs, k) => {
    best[k] = [];
    from[k] = [];
    for (const d of D) {
      best[k][d] = Infinity;
      if (!cs.some((c) => c.difficulty === d)) continue;
      if (k === 0) {
        best[k][d] = cost(k, d);
        continue;
      }
      for (const e of D) {
        if (e <= d && best[k - 1][e] + cost(k, d) < best[k][d]) {
          best[k][d] = best[k - 1][e] + cost(k, d);
          from[k][d] = e;
        }
      }
    }
  });
  const last = cands.length - 1;
  let d = D.reduce((m, x) => (best[last][x] < best[last][m] ? x : m), 1);
  if (best[last][d] === Infinity) throw new Error(`chapter ${ch.no}: no non-decreasing difficulty sequence`);
  const picked: Cand[] = [];
  for (let k = last; k >= 0; k--) {
    picked[k] = cands[k].find((c) => c.difficulty === d)!;
    d = from[k][d];
  }
  return picked;
}

function main(): void {
  const t0 = Date.now();
  const stages: Stage[] = [];
  const seen = new Set<RoleId>();
  for (const ch of CHAPTERS) {
    const cands: Cand[][] = [];
    for (let id = ch.stages[0]; id <= ch.stages[1]; id++) {
      const t = Date.now();
      const cs = candidates(id);
      cands.push(cs);
      const hist = [1, 2, 3, 4, 5].map((d) => cs.filter((c) => c.difficulty === d).length).join('/');
      const p = stageParams(id);
      console.error(`stage ${id} ${p.w}x${p.h}: ${cs.length} candidates, difficulty 1-5 = ${hist}, ${((Date.now() - t) / 1000).toFixed(1)} s`);
    }
    pickChapter(ch, cands).forEach((c, k) => {
      const id = ch.stages[0] + k;
      const roles = [...new Set([...c.def.inPlay, ...c.def.faces])];
      const newRoles = roles.filter((r) => !seen.has(r));
      newRoles.forEach((r) => seen.add(r));
      stages.push({ id, chapter: ch.no, def: c.def, difficulty: c.difficulty, newRoles, abilities: c.abilities, steps: c.steps });
      console.error(`  -> stage ${id}: difficulty ${c.difficulty}, seed ${c.def.seed}, inPlay ${c.def.inPlay.join(' ')}`);
    });
  }
  writeFileSync(OUT, `[\n${stages.map((s) => JSON.stringify(s)).join(',\n')}\n]\n`);
  console.error(`wrote ${stages.length} stages to ${OUT.pathname} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main();
