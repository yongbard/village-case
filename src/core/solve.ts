// 주 솔버: 칸 순서대로 진짜 직업을 정하는 백트래킹.
// 진술은 참조 칸이 다 정해지는 순간 판정한다. 진짜 증인의 진술은 오염 여부를 모르므로
// "참으로 말할 수 있나 / 거짓으로 말할 수 있나"만 기록하고, 오염 대상은 끝에서 정확히 맞춘다.
// 내보내는 세계는 모두 consistent() 로 다시 확인한다.
import { colOf, diagOf, nbr4, nbr8, rowOf, sideCells, steps } from './board';
import { ROLES, role } from './roles';
import { cellAdmits, clueFact, consistent, modeAt, pairSameFact } from './rules';
import { ANY_WITNESS, type Clue, type Knowledge, type RoleId, type World } from './types';

export const WORLD_CAP = 20000;

/** 비교용 정규 문자열 */
export function worldKey(w: World): string {
  return `${w.roles.join(',')}|${w.taint.join(',')}`;
}

/**
 * 세계 표현에서 진짜 증인 칸의 값: 체포로 드러난 증인 직업 → 그 직업, 조사했으면 겉 직업,
 * 아니면 ANY_WITNESS. 두 솔버와 normalize 가 모두 이 규칙을 쓴다.
 */
export function witnessValue(k: Knowledge, i: number): RoleId {
  const a = k.arrested[i];
  if (a !== undefined && a !== ANY_WITNESS && role(a).camp === 'witness') return a;
  const f = k.faces[i];
  if (f !== undefined && role(f).camp === 'witness') return f;
  return ANY_WITNESS;
}

/** 진술의 참·거짓을 정하는 데 필요한 칸 (말하는 칸 제외) */
export function clueRefs(w: number, h: number, c: Clue): number[] {
  switch (c.kind) {
    case 'evil4': return nbr4(w, h, c.base);
    case 'evil8': return nbr8(w, h, c.base);
    case 'evilRow': return rowOf(w, h, c.base);
    case 'evilCol': return colOf(w, h, c.base);
    case 'diag': return diagOf(w, h, c.base);
    case 'pairOne':
    case 'sameSide':
      return [c.a!, c.b!];
    case 'alibi':
    case 'accuse':
      return [c.a!];
    case 'atLeastOne': return [...c.cells!];
    case 'bossDir': return sideCells(w, h, c.base, c.dir!);
    case 'bossRow': return Array.from({ length: w }, (_, x) => (c.r! - 1) * w + x);
    case 'nearest':
    case 'adjPair':
    case 'halves':
      return Array.from({ length: w * h }, (_, i) => i);
  }
}

/**
 * 시간 한도 (힌트용). deadline(performance.now 기준)을 넘으면 탐색을 멈추고 expired 를 켠다.
 * 멈춘 탐색은 세계를 다 찾지 못했으므로, 부른 쪽은 expired 를 보고 결과를 증명으로 쓰지 않는다.
 */
export interface Budget {
  deadline: number;
  expired: boolean;
}

/** 한도를 넘었는가 (넘었으면 expired 를 켠다) */
export function overBudget(b: Budget | undefined): boolean {
  if (!b) return false;
  if (!b.expired && performance.now() > b.deadline) b.expired = true;
  return b.expired;
}

interface Stmt {
  cell: number;
  /** 지금 정해진 직업으로 본 진술의 사실값 (참이면 true) */
  fact: (world: World) => boolean;
}

/**
 * 관찰과 맞는 세계를 하나씩 visit 에 넘긴다. visit 이 true 를 돌려주면 중단.
 * order: 칸을 채우는 순서(칸 번호의 순열). 기본은 칸 번호 순. 순서는 찾는 속도만 바꾸고 세계의 집합은 같다.
 * budget: 시간 한도. 넘으면 중단하고 budget.expired 를 켠다 (그때까지 넘긴 세계는 맞지만 전부는 아니다).
 */
export function forEachWorld(
  k: Knowledge,
  visit: (w: World) => boolean | void,
  order?: readonly number[],
  budget?: Budget,
): void {
  if (budget?.expired) return;
  const { w, h } = k;
  const n = w * h;
  const inPlay = k.inPlay;
  const m = inPlay.length;
  if (new Set(inPlay).size !== m) return;
  for (const id of inPlay) if (!(id in ROLES) || role(id).camp === 'witness') return;

  // 칸마다 후보: 진짜 증인(정규 값) 또는 inPlay 직업 중 겉 직업·체포와 맞는 것. -1 = 진짜 증인
  const cand: number[][] = [];
  const wv: RoleId[] = [];
  for (let i = 0; i < n; i++) {
    wv.push(witnessValue(k, i));
    const c: number[] = [];
    if (cellAdmits(k, i, wv[i])) c.push(-1);
    for (let j = 0; j < m; j++) if (cellAdmits(k, i, inPlay[j])) c.push(j);
    if (c.length === 0) return;
    cand.push(c);
  }

  // pos[칸] = 몇 번째로 채우는가. 아래의 "앞 칸"·"가장 뒤 칸"은 모두 이 순서 기준이다.
  const ord = order ?? Array.from({ length: n }, (_, i) => i);
  const pos: number[] = Array(n).fill(-1);
  ord.forEach((c, p) => (pos[c] = p));
  if (ord.length !== n || pos.includes(-1)) throw new Error('order must be a permutation of cells');
  const lastPos = (cells: number[]) => Math.max(...cells.map((c) => pos[c]));

  // 진술: 참조 칸 중 가장 뒤 칸이 정해질 때 판정
  const byTrigger: Stmt[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (!c) continue;
    const trig = lastPos([i, ...clueRefs(w, h, c)]);
    byTrigger[trig].push({ cell: i, fact: (wd) => clueFact(w, h, wd, c) });
  }
  for (const o of k.abilities) {
    const trig = lastPos([o.cell, o.a, o.b]);
    byTrigger[trig].push({ cell: o.cell, fact: (wd) => o.same === pairSameFact(wd, o.a, o.b) });
  }

  // 진술은 참조 칸이 다 정해지는 칸에서 판정하지만, 그 전이라도 앞 칸까지로 사실값이 정해지면 미리 판정한다
  // (악의 수·가장 가까운 악·주범 줄). 판정은 같은 사실값으로 몇 번 해도 결과가 같다(아래 apply).
  const early: { cell: number; trig: number; partial: (i: number) => boolean | undefined }[] = [];
  const isCountedRole = (id: RoleId) => {
    const rd = role(id);
    return (rd.camp === 'accomplice' || rd.camp === 'boss') && !rd.hiddenFromCounts;
  };
  const counted = (j: number) => isCountedRole(roles[j]);
  const countedRoles = inPlay.flatMap((id, j) => (isCountedRole(id) ? [j] : []));
  /** 아직 칸에 안 놓인, 세어지는 직업 수 */
  const unplacedCounted = () => countedRoles.filter((j) => at[j] < 0).length;
  for (let s = 0; s < n; s++) {
    const c = k.clues[s];
    if (c && (c.kind === 'evil4' || c.kind === 'evil8' || c.kind === 'evilRow' || c.kind === 'evilCol')) {
      const refs = clueRefs(w, h, c);
      const N = c.n!;
      early.push({
        cell: s,
        trig: lastPos([s, ...refs]),
        partial: (i) => {
          let cnt = 0;
          let rem = 0;
          for (const j of refs) {
            if (pos[j] > i) rem++;
            else if (counted(j)) cnt++;
          }
          // 앞으로 늘 수 있는 수는 남은 참조 칸 수와 남은 세어지는 직업 수 중 작은 것
          if (cnt > N || cnt + Math.min(rem, unplacedCounted()) < N) return false;
          return undefined;
        },
      });
    } else if (c?.kind === 'nearest') {
      const b = c.base;
      const N = c.n!;
      const dist = Array.from({ length: n }, (_, j) => steps(w, b, j));
      let lastBelow = -1; // 거리 N 미만 칸 중 가장 뒤 칸
      let lastUpTo = -1; // 거리 N 이하 칸 중 가장 뒤 칸
      for (let j = 0; j < n; j++) {
        if (j === b) continue;
        if (dist[j] < N) lastBelow = Math.max(lastBelow, pos[j]);
        if (dist[j] <= N) lastUpTo = Math.max(lastUpTo, pos[j]);
      }
      early.push({
        cell: s,
        trig: n - 1,
        partial: (i) => {
          let dmin = Infinity;
          for (let q = 0; q <= i; q++) {
            const j = ord[q];
            if (j !== b && counted(j) && dist[j] < dmin) dmin = dist[j];
          }
          // 세어지는 직업이 다 놓였으면 더 가까운 악은 생기지 않는다
          if (unplacedCounted() === 0) return dmin === Infinity ? N === 0 : dmin === N;
          if (N <= 0) return dmin < Infinity ? false : undefined;
          if (dmin < N) return false;
          if (dmin === N) return lastBelow <= i ? true : undefined;
          return lastUpTo <= i ? false : undefined;
        },
      });
    } else if (c?.kind === 'bossRow') {
      const N = c.n!;
      const bosses = inPlay.flatMap((id, j) => (role(id).camp === 'boss' ? [j] : []));
      const rowLast = N >= 1 && N <= h ? lastPos(Array.from({ length: w }, (_, x) => (N - 1) * w + x)) : -1;
      early.push({
        cell: s,
        trig: n - 1,
        partial: (i) => {
          if (N < 1 || N > h) return false;
          // 주범 직업이 하나면: 놓이면 그 줄로, 그 줄이 다 정해졌는데 없으면 거짓
          if (bosses.length === 1) {
            const b = at[bosses[0]];
            if (b >= 0) return Math.floor(b / w) + 1 === N;
            return rowLast <= i ? false : undefined;
          }
          // 여럿이면 clueFact 처럼 칸 번호가 가장 작은 주범을 본다: 번호 순으로 정해진 칸까지만 따라간다
          for (let j = 0; j < n; j++) {
            if (pos[j] > i) return j >= N * w ? false : undefined; // N 번째 줄까지 다 정해졌는데 주범이 없다
            if (role(roles[j]).camp === 'boss') return Math.floor(j / w) + 1 === N;
          }
          return false;
        },
      });
    }
  }

  const tainterIdx = inPlay.flatMap((id, j) => (role(id).taint ? [j] : []));
  const nTainters = tainterIdx.length;
  const adj4Only = nTainters > 0 && tainterIdx.every((j) => role(inPlay[j]).taint === 'adj4');
  const maxN4 = Array.from({ length: n }, (_, i) => lastPos([i, ...nbr4(w, h, i)]));
  const maxN8 = Array.from({ length: n }, (_, i) => lastPos([i, ...nbr8(w, h, i)]));
  const lookouts = inPlay.flatMap((id, j) => (role(id).place === 'bossIn8' ? [j] : []));

  const roles: RoleId[] = Array(n).fill(ANY_WITNESS);
  const world: World = { roles, taint: Array(n).fill(-1) };
  const at: number[] = Array(m).fill(-1); // inPlay 직업이 놓인 칸
  // 진짜 증인 칸: 지금까지 판정한 진술이 "오염 안 됨(참)" / "오염됨(거짓)" 과 맞는가
  const canTrue: boolean[] = Array(n).fill(true);
  const canFalse: boolean[] = Array(n).fill(true);
  const mustTaint: number[] = []; // canTrue 가 꺼진 증인 칸
  let placed = 0;
  let stop = false;
  let ticks = 0;

  const isWitness = (i: number) => role(roles[i]).camp === 'witness';

  /** 말한 칸 c 의 진술 사실값이 fact 일 때 판정. 모순이면 false. 같은 사실값으로 다시 불러도 아무것도 바꾸지 않는다. */
  const apply = (c: number, fact: boolean, trail: number[]): boolean => {
    const md = modeAt(world, c); // 오염 없는 상태의 말하는 방식
    const okTrue = md === 'any' || fact === (md === 'true');
    if (!isWitness(c)) return okTrue;
    const okFalse = !fact;
    if ((canTrue[c] && !okTrue) || (canFalse[c] && !okFalse)) {
      trail.push(c, (canTrue[c] ? 1 : 0) | (canFalse[c] ? 2 : 0));
      if (canTrue[c] && !okTrue) {
        mustTaint.push(c);
        trail.push(-1); // mustTaint 에 넣었다는 표시
      }
      canTrue[c] = canTrue[c] && okTrue;
      canFalse[c] = canFalse[c] && okFalse;
      if (!canTrue[c] && !canFalse[c]) return false;
      if (mustTaint.length > nTainters) return false;
    }
    return true;
  };

  /** i 번째 칸(ord[i])을 정한 직후 검사. 바꾼 상태는 trail 에 적는다. */
  const check = (i: number, trail: number[]): boolean => {
    for (const s of byTrigger[i]) if (!apply(s.cell, s.fact(world), trail)) return false;
    for (const e of early) {
      if (pos[e.cell] > i || e.trig <= i) continue; // 말한 칸이 아직 안 정해졌거나, 이미 참조 칸이 다 정해짐
      const fact = e.partial(i);
      if (fact !== undefined && !apply(e.cell, fact, trail)) return false;
    }
    // 틀린 증인은 adj4 오염원의 이웃이어야 한다 (오염원이 adj4 뿐일 때)
    if (adj4Only) {
      for (const s of mustTaint) {
        if (maxN4[s] > i) continue;
        if (!nbr4(w, h, s).some((j) => role(roles[j]).taint === 'adj4')) return false;
      }
    }
    // 망보기: 둘레 8칸이 다 정해지면 주범이 있어야 한다
    for (const j of lookouts) {
      const p = at[j];
      if (p < 0 || maxN8[p] !== i) continue;
      if (!nbr8(w, h, p).some((q) => role(roles[q]).camp === 'boss')) return false;
    }
    return true;
  };

  const undo = (trail: number[]) => {
    while (trail.length > 0) {
      let x = trail.pop()!;
      if (x === -1) {
        mustTaint.pop();
        x = trail.pop()!;
      }
      const c = trail.pop()!;
      canTrue[c] = (x & 1) !== 0;
      canFalse[c] = (x & 2) !== 0;
    }
  };

  /** 다 채운 뒤: 오염 대상 조합을 정확히 맞춰 내보낸다 */
  const emit = () => {
    const tainters: number[] = [];
    const options: number[][] = [];
    for (const j of tainterIdx) {
      const p = at[j];
      const t = role(inPlay[j]).taint!;
      const pool = t === 'adj4' ? nbr4(w, h, p) : Array.from({ length: n }, (_, q) => q);
      const eligible = pool.filter((q) => q !== p && isWitness(q));
      tainters.push(p);
      options.push(eligible.length === 0 ? [-1] : eligible.filter((q) => canFalse[q]));
    }
    const taint: number[] = Array(n).fill(-1);
    const rec = (d: number): void => {
      if (stop) return;
      if (d === tainters.length) {
        for (const s of mustTaint) if (!tainters.some((p) => taint[p] === s)) return;
        const wd: World = { roles: [...roles], taint: [...taint] };
        if (!consistent(k, wd)) return;
        if (visit(wd) === true) stop = true;
        return;
      }
      for (const q of options[d]) {
        taint[tainters[d]] = q;
        rec(d + 1);
      }
      taint[tainters[d]] = -1;
    };
    rec(0);
  };

  const fill = (i: number): void => {
    if (stop) return;
    if (budget && (++ticks & 1023) === 0 && overBudget(budget)) {
      stop = true;
      return;
    }
    if (i === n) {
      if (placed === m) emit();
      return;
    }
    const cell = ord[i];
    for (const j of cand[cell]) {
      if (j >= 0 && at[j] >= 0) continue;
      const placedAfter = placed + (j >= 0 ? 1 : 0);
      if (m - placedAfter > n - i - 1) continue; // 남은 칸보다 남은 직업이 많다
      roles[cell] = j >= 0 ? inPlay[j] : wv[cell];
      if (j >= 0) at[j] = cell;
      placed = placedAfter;
      const trail: number[] = [];
      if (check(i, trail)) fill(i + 1);
      undo(trail);
      if (j >= 0) {
        at[j] = -1;
        placed--;
      }
      roles[cell] = ANY_WITNESS;
      if (stop) return;
    }
  };

  fill(0);
}

/** budget 을 넘겨 멈추면 budget.expired 가 켜지고 worlds 는 일부다 */
export function solve(k: Knowledge, cap = WORLD_CAP, budget?: Budget): { worlds: World[]; capped: boolean } {
  const worlds: World[] = [];
  let capped = false;
  forEachWorld(
    k,
    (wd) => {
      if (worlds.length >= cap) {
        capped = true;
        return true;
      }
      worlds.push(wd);
    },
    undefined,
    budget,
  );
  return { worlds, capped };
}
