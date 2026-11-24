// 시험용 무작위 사건·관찰 만들기
import { nbr8 } from './board';
import { assignTaint, makeClue, makeFaces } from './makeCase';
import { pick, randInt, shuffle, type Rng } from './rng';
import { ROLES, role, rosterOf } from './roles';
import { abilityTruth } from './rules';
import { witnessValue } from './solve';
import { type AbilityObs, type Camp, type CaseDef, type Knowledge, type RoleId, type World } from './types';

const idsOf = (camp: Camp): RoleId[] => Object.values(ROLES).filter((d) => d.camp === camp).map((d) => d.id);
const WITNESSES = idsOf('witness');

/** 말썽꾼 0~1, 공범 1~2, 주범 1~2, 합 max 이하. 같은 직업은 2명까지 (정렬) */
export function randomInPlay(r: Rng, max: number): RoleId[] {
  let nT = randInt(r, 0, 1);
  let nA = randInt(r, 1, 2);
  let nB = randInt(r, 1, 2);
  while (nT + nA + nB > max && nT > 0) nT--;
  while (nT + nA + nB > max && nB > 1) nB--;
  while (nT + nA + nB > max && nA > 1) nA--;
  const out: RoleId[] = [];
  const draw = (camp: Camp, k: number) => {
    for (let j = 0; j < k; j++) {
      const ok = idsOf(camp).filter((id) => out.filter((x) => x === id).length < 2);
      out.push(pick(r, ok));
    }
  };
  draw('trouble', nT);
  draw('accomplice', nA);
  draw('boss', nB);
  return out.sort();
}

/** 실제 세계: 증인 칸은 구체 증인 직업(중복 허용), inPlay 는 직업마다 그 수만큼, 망보기는 주범 둘레 8칸 안, 오염은 assignTaint */
export function randomTruth(r: Rng, w: number, h: number, inPlay: RoleId[]): World {
  const n = w * h;
  const cellsAll = Array.from({ length: n }, (_, i) => i);
  for (;;) {
    const roles = cellsAll.map(() => pick(r, WITNESSES));
    const cells = shuffle(r, cellsAll);
    inPlay.forEach((id, j) => (roles[cells[j]] = id));
    const ok = roles.every(
      (id, i) => role(id).place !== 'bossIn8' || nbr8(w, h, i).some((j) => role(roles[j]).camp === 'boss'),
    );
    const taint = ok ? assignTaint(r, w, h, roles) : null;
    if (taint) return { roles, taint };
  }
}

/** 일부 조사(겉 직업·진술), 일부 체포(진짜 직업), 기자 능력 관찰 0~1개. 모두 truth 기준. */
export function randomKnowledge(r: Rng, truth: World, w: number, h: number): Knowledge {
  const n = w * h;
  const k = emptyKnowledge(w, h, truth.roles.filter((id) => role(id).camp !== 'witness').sort(), rosterOf(truth.roles));
  const faces = makeFaces(r, truth, WITNESSES);
  // 조사 비율: 1/4 은 전부, 나머지는 50~100% (적어도 절반은 조사한다).
  // 이보다 적게 조사하면 맞는 세계가 WORLD_CAP 을 넘어 solve 가 잘리는 판이 생긴다.
  const p = r() < 0.25 ? 1 : 0.5 + 0.5 * r();
  for (let i = 0; i < n; i++) {
    if (r() >= p) continue;
    k.faces[i] = faces[i];
    // 종지기 진술은 시각 계기라 공개됐을 수도, 아닐 수도 있다
    if (role(faces[i]).trigger !== undefined && r() < 0.5) continue;
    k.clues[i] = makeClue(r, w, h, truth, i, faces[i]);
  }
  for (const i of shuffle(r, Array.from({ length: n }, (_, j) => j)).slice(0, randInt(r, 0, 2))) {
    k.arrested[i] = truth.roles[i];
  }
  const reporters = k.faces.flatMap((f, i) => (f !== undefined && role(f).ability === 'pairSame' ? [i] : []));
  if (reporters.length > 0 && r() < 0.5) {
    const cell = pick(r, reporters);
    const [a, b] = shuffle(r, Array.from({ length: n }, (_, j) => j).filter((j) => j !== cell)).slice(0, 2);
    const t = abilityTruth(truth, cell, a, b);
    const obs: AbilityObs = { cell, a, b, same: t === 'any' ? r() < 0.5 : t };
    k.abilities.push(obs);
  }
  return k;
}

/** 솔버와 같은 표현으로: 진짜 증인 칸은 witnessValue(조사 → 겉 직업, 체포 → 드러난 직업, 아니면 ANY_WITNESS) */
export function normalize(truth: World, k: Knowledge): World {
  return {
    roles: truth.roles.map((id, i) => (role(id).camp === 'witness' ? witnessValue(k, i) : id)),
    taint: [...truth.taint],
  };
}

export function emptyKnowledge(w: number, h: number, inPlay: RoleId[], roster: Record<RoleId, number> = {}): Knowledge {
  const n = w * h;
  return {
    w, h, inPlay: [...inPlay], roster: { ...roster },
    faces: Array(n).fill(undefined),
    clues: Array(n).fill(null),
    abilities: [],
    arrested: Array(n).fill(undefined),
  };
}

/** 아무것도 조사 안 한 상태 */
export function emptyKnowledgeOf(def: CaseDef): Knowledge {
  return emptyKnowledge(def.w, def.h, def.inPlay, def.roster);
}

/** 시간 한도 시험의 배수: CI(GitHub 러너)는 느릴 수 있어 3배로 둔다. 로컬은 1. */
export const TIME_SCALE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CI ? 3 : 1;
