// 주 솔버: 칸 순서대로 진짜 직업을 정하는 백트래킹.
// 진술은 참조 칸이 다 정해지는 순간 판정한다. 진짜 증인의 진술은 오염 여부를 모르므로
// "참 / 거짓(바꿔치기·매수) / 방패(협박)로 말할 수 있나"만 기록하고, 원천의 대상은 끝에서 정확히 맞춘다.
// 내보내는 세계는 모두 consistent() 로 다시 확인한다.
import { colOf, diagOf, nbr4, nbr8, rowOf, sideCells, steps } from './board';
import { ROLES, role } from './roles';
import { abilityAs, cellAdmits, consistent, holdsAs, isCountKind, modeAt, taintEligible } from './rules';
import { ANY_WITNESS, type Clue, type Knowledge, type Mode, type RoleId, type World } from './types';

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
  /** 말하는 방식 m 으로 이 진술(능력 관찰)을 할 수 있는가. 참조 칸이 다 정해졌을 때 부른다. */
  holds: (world: World, m: Mode) => boolean;
}

/** 누명이 바꿀 수 있는 진술(악을 세는 진술): 모사꾼이 있으면 누명 대상이 정해지는 끝(emit)에서만 판정한다 */
const frameDependent = (c: Clue): boolean =>
  isCountKind(c.kind) || c.kind === 'nearest' || c.kind === 'adjPair' || c.kind === 'halves';

/**
 * 관찰과 맞는 세계를 하나씩 visit 에 넘긴다. visit 이 true 를 돌려주면 중단.
 * order: 칸을 채우는 순서(칸 번호의 순열). 기본은 칸 번호 순. 순서는 찾는 속도만 바꾸고 세계의 집합은 같다.
 * budget: 시간 한도. 넘으면 중단하고 budget.expired 를 켠다 (그때까지 넘긴 세계는 맞지만 전부는 아니다).
 * 같은 직업이 여럿이면 앞 번호 복사본을 채우는 순서상 앞 칸에만 놓아, 같은 세계를 한 번만 낸다.
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
  const inPlay = [...k.inPlay].sort();
  const m = inPlay.length;
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

  const effectOf = (id: RoleId) => role(id).effect;
  const hasFrame = inPlay.some((id) => effectOf(id) === 'frame');
  const hasLie = inPlay.some((id) => effectOf(id) === 'lie');
  const hasShield = inPlay.some((id) => effectOf(id) === 'shield');
  /** 증인을 거짓말(lie)·방패(shield)로 바꾸는 원천 */
  const turnerIdx = inPlay.flatMap((id, j) => (effectOf(id) === 'lie' || effectOf(id) === 'shield' ? [j] : []));
  const nTurners = turnerIdx.length;
  const adj4Only = nTurners > 0 && turnerIdx.every((j) => role(inPlay[j]).taint === 'adj4');
  const sourceIdx = inPlay.flatMap((id, j) => (role(id).taint ? [j] : []));

  // 진술: 참조 칸 중 가장 뒤 칸이 정해질 때 판정 (누명에 기대는 진술은 끝에서 consistent 가 판정)
  const byTrigger: Stmt[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (!c || (hasFrame && frameDependent(c))) continue;
    const trig = lastPos([i, ...clueRefs(w, h, c)]);
    byTrigger[trig].push({ cell: i, holds: (wd, md) => holdsAs(w, h, wd, c, md) });
  }
  for (const o of k.abilities) {
    const trig = lastPos([o.cell, o.a, o.b]);
    byTrigger[trig].push({
      cell: o.cell,
      holds: (wd, md) => {
        const t = abilityAs(wd, md, o.a, o.b);
        return t === 'any' || t === o.same;
      },
    });
  }

  // 악의 수·가장 가까운 악은 참조 칸이 다 정해지기 전이라도 앞 칸까지로 사실값(실제 세계 기준)이 정해지면 미리 판정한다.
  // 판정은 같은 사실값으로 몇 번 해도 결과가 같다(아래 apply).
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
    if (!c || hasFrame) continue;
    if (isCountKind(c.kind)) {
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
    } else if (c.kind === 'nearest') {
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
    }
  }

  const maxN4 = Array.from({ length: n }, (_, i) => lastPos([i, ...nbr4(w, h, i)]));
  const maxN8 = Array.from({ length: n }, (_, i) => lastPos([i, ...nbr8(w, h, i)]));
  const lookouts = inPlay.flatMap((id, j) => (role(id).place === 'bossIn8' ? [j] : []));

  const roles: RoleId[] = Array(n).fill(ANY_WITNESS);
  const world: World = { roles, taint: Array(n).fill(-1) };
  const at: number[] = Array(m).fill(-1); // inPlay 직업이 놓인 칸
  // 진짜 증인 칸: 지금까지 판정한 진술이 "참(오염 없음) / 거짓(lie) / 방패(shield)" 와 맞는가
  const canTrue: boolean[] = Array(n).fill(true);
  const canFalse: boolean[] = Array(n).fill(hasLie);
  const canShield: boolean[] = Array(n).fill(hasShield);
  const mustTaint: number[] = []; // canTrue 가 꺼진 증인 칸
  const witCount = new Map<RoleId, number>(); // 직업이 정해진 진짜 증인 수 (roster 이하)
  let placed = 0;
  let stop = false;
  let ticks = 0;

  const isWitness = (i: number) => role(roles[i]).camp === 'witness';

  /**
   * 말한 칸 c 의 진술 판정. ok(md) 는 방식 md 로 말할 수 있는가(모르면 undefined). 모순이면 false.
   * 같은 판정을 다시 불러도 아무것도 바꾸지 않는다.
   */
  const apply = (c: number, ok: (md: Mode) => boolean | undefined, trail: number[]): boolean => {
    if (!isWitness(c)) return ok(modeAt(world, c)) !== false;
    const t = canTrue[c] && ok('true') === false;
    const f = canFalse[c] && ok('false') === false;
    const s = canShield[c] && ok('shield') === false;
    if (!t && !f && !s) return true;
    trail.push(c, (canTrue[c] ? 1 : 0) | (canFalse[c] ? 2 : 0) | (canShield[c] ? 4 : 0));
    if (t) {
      mustTaint.push(c);
      trail.push(-1); // mustTaint 에 넣었다는 표시
      canTrue[c] = false;
    }
    if (f) canFalse[c] = false;
    if (s) canShield[c] = false;
    if (!canTrue[c] && !canFalse[c] && !canShield[c]) return false;
    return mustTaint.length <= nTurners;
  };

  /** i 번째 칸(ord[i])을 정한 직후 검사. 바꾼 상태는 trail 에 적는다. */
  const check = (i: number, trail: number[]): boolean => {
    for (const s of byTrigger[i]) {
      if (!apply(s.cell, (md) => s.holds(world, md), trail)) return false;
    }
    for (const e of early) {
      if (pos[e.cell] > i || e.trig <= i) continue; // 말한 칸이 아직 안 정해졌거나, 이미 참조 칸이 다 정해짐
      const fact = e.partial(i);
      if (fact === undefined) continue;
      const ok = (md: Mode) => (md === 'true' ? fact : md === 'false' ? !fact : undefined);
      if (!apply(e.cell, ok, trail)) return false;
    }
    // 참일 수 없는 증인은 adj4 원천의 이웃이어야 한다 (거짓·방패 원천이 adj4 뿐일 때)
    if (adj4Only) {
      for (const s of mustTaint) {
        if (maxN4[s] > i) continue;
        if (!nbr4(w, h, s).some((j) => { const e = effectOf(roles[j]); return e === 'lie' || e === 'shield'; })) return false;
      }
    }
    // 망보기: 둘레 8칸이 다 정해지면 진짜 주범이 있어야 한다
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
      canShield[c] = (x & 4) !== 0;
    }
  };

  /** 다 채운 뒤: 원천마다 대상(겹치지 않게)을 정확히 맞춰 내보낸다 */
  const emit = () => {
    const sources: number[] = [];
    const options: number[][] = [];
    for (const j of sourceIdx) {
      const p = at[j];
      const e = effectOf(inPlay[j]);
      const eligible = taintEligible(w, h, roles, p);
      sources.push(p);
      if (eligible.length === 0) options.push([-1]);
      else if (e === 'lie') options.push(eligible.filter((q) => canFalse[q]));
      else if (e === 'shield') options.push(eligible.filter((q) => canShield[q]));
      else options.push(eligible);
    }
    const taint: number[] = Array(n).fill(-1);
    const used = new Set<number>();
    const rec = (d: number): void => {
      if (stop) return;
      if (d === sources.length) {
        for (const s of mustTaint) {
          if (!sources.some((p) => taint[p] === s && effectOf(roles[p]) !== 'frame')) return;
        }
        const wd: World = { roles: [...roles], taint: [...taint] };
        if (!consistent(k, wd)) return;
        if (visit(wd) === true) stop = true;
        return;
      }
      for (const q of options[d]) {
        if (q >= 0 && used.has(q)) continue;
        taint[sources[d]] = q;
        if (q >= 0) used.add(q);
        rec(d + 1);
        if (q >= 0) used.delete(q);
      }
      taint[sources[d]] = -1;
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
      // 같은 직업은 앞 번호 복사본부터 놓는다
      if (j > 0 && inPlay[j - 1] === inPlay[j] && at[j - 1] < 0) continue;
      const placedAfter = placed + (j >= 0 ? 1 : 0);
      if (m - placedAfter > n - i - 1) continue; // 남은 칸보다 남은 직업이 많다
      const wid = j >= 0 ? inPlay[j] : wv[cell];
      // 직업이 정해진 진짜 증인은 공개된 인원을 넘지 않는다
      const counts = j < 0 && wid !== ANY_WITNESS;
      if (counts && (witCount.get(wid) ?? 0) >= (k.roster[wid] ?? 0)) continue;
      roles[cell] = wid;
      if (counts) witCount.set(wid, (witCount.get(wid) ?? 0) + 1);
      if (j >= 0) at[j] = cell;
      placed = placedAfter;
      const trail: number[] = [];
      if (check(i, trail)) fill(i + 1);
      undo(trail);
      if (j >= 0) {
        at[j] = -1;
        placed--;
      }
      if (counts) witCount.set(wid, witCount.get(wid)! - 1);
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
