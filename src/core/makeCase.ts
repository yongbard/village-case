import { sideCells } from './board';
import { pick, type Rng } from './rng';
import { role } from './roles';
import { countCells, statementHolds, taintEligible } from './rules';
import { ANY_WITNESS, type Clue, type ClueKind, type RoleId, type World } from './types';

/**
 * 오염원마다 대상 칸을 고른다: 대상 후보(taintEligible) 중 다른 원천이 아직 안 고른 칸에서 무작위, 후보가 없으면 -1.
 * 후보는 있는데 다 다른 원천이 골라 겹칠 수밖에 없으면 null (consistent 가 겹침을 허락하지 않는다).
 */
export function assignTaint(r: Rng, w: number, h: number, roles: RoleId[]): number[] | null {
  const taint: number[] = roles.map(() => -1);
  const used = new Set<number>();
  for (let i = 0; i < roles.length; i++) {
    const eligible = taintEligible(w, h, roles, i);
    if (eligible.length === 0) continue;
    const free = eligible.filter((j) => !used.has(j));
    if (free.length === 0) return null;
    taint[i] = pick(r, free);
    used.add(taint[i]);
  }
  return taint;
}

/** 겉 직업: 진짜 증인은 자기 직업, 말썽꾼(self)은 자기 직업, 숨은이·공범·주범은 증인 직업 중 무작위 */
export function makeFaces(r: Rng, truth: World, witnessPool: RoleId[]): RoleId[] {
  return truth.roles.map((id) => {
    const def = role(id);
    if (def.camp === 'witness') return id === ANY_WITNESS ? pick(r, witnessPool) : id;
    const disguises = def.camp === 'accomplice' || def.camp === 'boss' || def.face === 'witness';
    return disguises ? pick(r, witnessPool) : id;
  });
}

/** 진술 형식 kind 로 기준 칸 base 에서 할 수 있는 진술 전부 (말한 칸 cell 은 대상으로 짚지 않는다) */
function candidates(w: number, h: number, truth: World, kind: ClueKind, base: number, cell: number): Clue[] {
  const n = w * h;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== cell);
  const nums = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, v) => ({ kind, base, n: lo + v }));
  switch (kind) {
    case 'evil4':
    case 'evil8':
    case 'evilRow':
    case 'evilCol':
    case 'diag':
      return nums(0, countCells(w, h, { kind, base }).length);
    case 'nearest':
      return nums(0, w + h - 2);
    case 'adjPair':
      return nums(0, 1);
    case 'halves':
      return nums(-1, 1);
    case 'alibi':
    case 'accuse':
      return others.map((a) => ({ kind, base, a }));
    case 'pairOne':
    case 'sameSide':
      return others.flatMap((a) => others.filter((b) => b > a).map((b) => ({ kind, base, a, b })));
    case 'atLeastOne':
      return others.flatMap((a) => others.filter((b) => b > a).flatMap((b) =>
        others.filter((c) => c > b).map((c) => ({ kind, base, cells: [a, b, c] }))));
    case 'bossDir':
      return (['up', 'down', 'left', 'right'] as const)
        .filter((dir) => sideCells(w, h, base, dir).length > 0)
        .map((dir) => ({ kind, base, dir }));
    case 'bossRow': {
      // 주범 수의 범위는 공개된 인원(주범 + 대역)으로 정한다
      const bosses = truth.roles.filter((id) => role(id).camp === 'boss' || role(id).decoy).length;
      const out: Clue[] = [];
      for (let r = 1; r <= h; r++) for (let v = 0; v <= Math.min(w, bosses); v++) out.push({ kind, base, r, n: v });
      return out;
    }
  }
}

/**
 * cell 칸이 겉 직업 face 의 형식으로 하는 진술: 그 칸의 말하는 방식(modeAt)으로 할 수 있는 진술 중 무작위.
 * 진술이 없는 겉 직업이거나 할 수 있는 진술이 없으면 null.
 */
export function makeClue(r: Rng, w: number, h: number, truth: World, cell: number, face: RoleId): Clue | null {
  const def = role(face);
  const kind = def.clue;
  if (!kind) return null;
  let base = cell;
  if (def.shift === 'right') {
    const x = cell % w;
    base = x < w - 1 ? cell + 1 : cell - 1;
  }
  const ok = candidates(w, h, truth, kind, base, cell).filter((c) => statementHolds(w, h, truth, cell, c));
  return ok.length === 0 ? null : pick(r, ok);
}
