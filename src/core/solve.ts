// 주 솔버: 칸 순서대로 진짜 직업을 정하는 백트래킹.
// 진술은 참조 칸이 다 정해지는 순간 판정한다. 진짜 증인의 진술은 오염 여부를 모르므로
// "참으로 말할 수 있나 / 거짓으로 말할 수 있나"만 기록하고, 오염 대상은 끝에서 정확히 맞춘다.
// 내보내는 세계는 모두 consistent() 로 다시 확인한다.
import { colOf, nbr4, nbr8, rowOf } from './board';
import { ROLES, role } from './roles';
import { clueFact, consistent, modeAt, pairSameFact } from './rules';
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

/** consistent() 의 겉 직업·체포·알려진 진영 검사를 한 칸에 대해 (같은 규칙) */
function cellAdmits(k: Knowledge, i: number, r: RoleId): boolean {
  const rd = role(r);
  const f = k.faces[i];
  if (f !== undefined) {
    const fd = role(f);
    if (fd.camp === 'witness') {
      const disguises = rd.camp === 'accomplice' || rd.camp === 'boss' || rd.face === 'witness';
      if (!disguises && !(rd.camp === 'witness' && (r === ANY_WITNESS || r === f || f === ANY_WITNESS))) return false;
    } else if (r !== f) {
      return false;
    }
  }
  const a = k.arrested[i];
  if (a !== undefined) {
    if (a === ANY_WITNESS) {
      if (rd.camp !== 'witness') return false;
    } else if (r !== a && !(r === ANY_WITNESS && role(a).camp === 'witness')) {
      return false;
    }
  }
  const kc = k.knownCamps?.[i];
  return kc === undefined || kc === rd.camp;
}

/** 진술의 참·거짓을 정하는 데 필요한 칸 (말하는 칸 제외) */
function clueRefs(w: number, h: number, c: Clue): number[] {
  switch (c.kind) {
    case 'evil4': return nbr4(w, h, c.base);
    case 'evil8': return nbr8(w, h, c.base);
    case 'evilRow': return rowOf(w, h, c.base);
    case 'evilCol': return colOf(w, h, c.base);
    case 'pairOne': return [c.a!, c.b!];
    case 'nearest':
    case 'bossRow':
      return Array.from({ length: w * h }, (_, i) => i);
  }
}

interface Stmt {
  cell: number;
  /** 지금 정해진 직업으로 본 진술의 사실값 (참이면 true) */
  fact: (world: World) => boolean;
}

/** 관찰과 맞는 세계를 하나씩 visit 에 넘긴다. visit 이 true 를 돌려주면 중단. */
export function forEachWorld(k: Knowledge, visit: (w: World) => boolean | void): void {
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

  // 진술: 참조 칸 중 가장 뒤 칸이 정해질 때 판정
  const byTrigger: Stmt[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const c = k.clues[i];
    if (!c) continue;
    const trig = Math.max(i, ...clueRefs(w, h, c));
    byTrigger[trig].push({ cell: i, fact: (wd) => clueFact(w, h, wd, c) });
  }
  for (const o of k.abilities) {
    const trig = Math.max(o.cell, o.a, o.b);
    byTrigger[trig].push({ cell: o.cell, fact: (wd) => o.same === pairSameFact(wd, o.a, o.b) });
  }

  const tainterIdx = inPlay.flatMap((id, j) => (role(id).taint ? [j] : []));
  const nTainters = tainterIdx.length;
  const adj4Only = nTainters > 0 && tainterIdx.every((j) => role(inPlay[j]).taint === 'adj4');
  const maxN4 = Array.from({ length: n }, (_, i) => Math.max(i, ...nbr4(w, h, i)));
  const maxN8 = Array.from({ length: n }, (_, i) => Math.max(i, ...nbr8(w, h, i)));
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

  const isWitness = (i: number) => role(roles[i]).camp === 'witness';

  /** 칸 i 를 정한 직후 검사. 바꾼 상태는 trail 에 적는다. */
  const check = (i: number, trail: number[]): boolean => {
    for (const s of byTrigger[i]) {
      const fact = s.fact(world);
      const md = modeAt(world, s.cell); // 오염 없는 상태의 말하는 방식
      const okTrue = md === 'any' || fact === (md === 'true');
      if (!isWitness(s.cell)) {
        if (!okTrue) return false;
        continue;
      }
      const okFalse = !fact;
      const c = s.cell;
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
    if (i === n) {
      if (placed === m) emit();
      return;
    }
    for (const j of cand[i]) {
      if (j >= 0 && at[j] >= 0) continue;
      const placedAfter = placed + (j >= 0 ? 1 : 0);
      if (m - placedAfter > n - i - 1) continue; // 남은 칸보다 남은 직업이 많다
      roles[i] = j >= 0 ? inPlay[j] : wv[i];
      if (j >= 0) at[j] = i;
      placed = placedAfter;
      const trail: number[] = [];
      if (check(i, trail)) fill(i + 1);
      undo(trail);
      if (j >= 0) {
        at[j] = -1;
        placed--;
      }
      roles[i] = ANY_WITNESS;
      if (stop) return;
    }
  };

  fill(0);
}

export function solve(k: Knowledge, cap = WORLD_CAP): { worlds: World[]; capped: boolean } {
  const worlds: World[] = [];
  let capped = false;
  forEachWorld(k, (wd) => {
    if (worlds.length >= cap) {
      capped = true;
      return true;
    }
    worlds.push(wd);
  });
  return { worlds, capped };
}
